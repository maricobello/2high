import "server-only";
import { parecerPadrao, type ResumoParecer } from "@/modules/rateio/parecer";
import { collectAllowedNumbers, guardGeneratedText } from "../guards";
import { getLLM, parseJsonResponse } from "../provider";
import { anonimizarFatura } from "@/modules/rateio/fatura-ia";

/**
 * IA como redatora do parecer de rateio: recebe números já calculados pelo motor
 * e escreve o texto para a Replace / fornecedor. Passa pelas guardas; se reprovar,
 * volta o parecer padrão.
 */
const SYSTEM = `Você é analista sênior de geração distribuída no Brasil e escreve pareceres técnicos de revisão de rateio de créditos, em português do Brasil, para a equipe da consultoria, o fornecedor da usina e o cliente.
Regras obrigatórias:
- Use SOMENTE os números do JSON de entrada, sem recalcular nem criar valores. Pode omitir números.
- Tom técnico, direto e seguro. Sem exclamações, sem emojis, sem promessas. Use "estimativa", "projeção", "sujeito à validação na fatura".
- Estrutura: contexto da usina (1 parágrafo), diagnóstico do rateio atual (1 parágrafo), proposta e efeito esperado (1 parágrafo), pontos de atenção e próximos passos (1 parágrafo curto).
- Não mencione inteligência artificial.
Responda em JSON: {"parecer": "texto com parágrafos separados por \\n\\n"}`;

export interface Parecer {
  texto: string;
  fonte: "llm" | "template";
  falhas: string[];
}

export async function redigirParecerRateio(resumo: ResumoParecer): Promise<Parecer> {
  const padrao = parecerPadrao(resumo);
  const llm = getLLM();
  if (!llm.available) return { texto: padrao, fonte: "template", falhas: ["IA não configurada"] };
  const allowed = collectAllowedNumbers(resumo);
  for (const v of [60, 100]) allowed.add(v);
  try {
    const raw = await llm.chat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(resumo) },
      ],
      { tier: "text", json: true, temperature: 0.3, maxTokens: 1500, task: "parecer_rateio" },
    );
    const parsed = parseJsonResponse<{ parecer?: string }>(raw);
    const texto = parsed?.parecer?.trim() ?? "";
    const guard = guardGeneratedText(texto, allowed);
    if (!guard.ok) return { texto: padrao, fonte: "template", falhas: guard.reasons };
    return { texto, fonte: "llm", falhas: [] };
  } catch (err) {
    return { texto: padrao, fonte: "template", falhas: [err instanceof Error ? err.message : "falha"] };
  }
}

const SYSTEM_PAINEL = `Você lê recortes da tela de gestão de usinas do sistema Orange (bloco "Energia", em kWh).
Devolva SOMENTE os números que aparecem na imagem, sem calcular nada, no formato brasileiro já convertido para número JSON (ex.: "3.239.006" -> 3239006; "-535.480,0" -> -535480).
Campos (use null quando o rótulo não aparecer): estimada, injetada, compensada, saldoInicial, saldoUtilizado, saldoVencido, saldoAdicionado, saldoAcumulado, geracaoRealizada, consumoUsina, divergencia (Divergência de Faturamento), balancoInjetada (Balanço Energia Injetada).
Responda só com o objeto JSON.`;

/** Lê o recorte da tela do Orange (imagem) com o modelo de visão. */
export async function lerPainelImagem(dataUrl: string): Promise<{ valores: Record<string, number | null> | null; erro?: string }> {
  const llm = getLLM();
  if (!llm.available) return { valores: null, erro: "IA não configurada" };
  try {
    const raw = await llm.chat(
      [
        { role: "system", content: SYSTEM_PAINEL },
        {
          role: "user",
          content: [
            { type: "text", text: "Leia os valores deste recorte. Só JSON." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      { tier: "vision", json: true, temperature: 0, maxTokens: 600, task: "painel_orange_imagem" },
    );
    return { valores: parseJsonResponse<Record<string, number | null>>(raw) };
  } catch (err) {
    return { valores: null, erro: err instanceof Error ? err.message : "falha" };
  }
}

const SYSTEM_FATURA = `Você lê o texto extraído (PDF) da fatura de energia de uma usina de geração distribuída (UC geradora) de qualquer distribuidora brasileira.
Devolva SOMENTE números que aparecem no texto, sem calcular, sem somar e sem arredondar: quando um valor vem separado por posto (ponta e fora ponta), devolva cada parte numa lista. Converta o formato brasileiro para número JSON ("124.580" -> 124580; "35.220,0000" -> 35220; "2,45" -> 2.45).
Campos (null quando não houver; listas com as partes como aparecem):
- distribuidora: nome curto (ex.: "RGE", "CELESC", "CEMIG").
- mesReferencia: mês de referência da fatura, "AAAA-MM".
- injetada: energia ativa injetada na rede pela usina no mês de referência, em kWh (todas as partes: ponta, fora ponta).
- consumoUsina: consumo próprio da usina no mês, em kWh (partes).
- excedente: energia excedente distribuída / alocada às UCs beneficiárias no mês, em kWh (partes).
- saldo: saldo de créditos de energia da própria usina, em kWh (partes).
- demandaContratada: demanda contratada de injeção/geração em kW (se não houver, a de consumo).
- demandaRegistrada: demanda medida/registrada de injeção/geração em kW (partes por posto).
- ultrapassagemKw: kW de ultrapassagem de demanda faturados.
- despesaUltrapassagem: valor em R$ cobrado por ultrapassagem de demanda.
- historico: lista de meses do histórico da fatura [{"mes":"AAAA-MM","injetada":[partes],"consumo":[partes],"excedente":[partes]}]; vazia se não houver.
Não confunda leituras do medidor (números de registro) com energia. Responda só com o objeto JSON.`;

/** Lê a fatura da usina com a IA (texto anonimizado). Os números são conferidos no navegador. */
export async function lerFaturaIa(linhas: string[]): Promise<{ leitura: unknown; erro?: string }> {
  const llm = getLLM();
  if (!llm.available) return { leitura: null, erro: "IA não configurada" };
  try {
    const raw = await llm.chat(
      [
        { role: "system", content: SYSTEM_FATURA },
        { role: "user", content: anonimizarFatura(linhas).join("\n").slice(0, 60_000) },
      ],
      { tier: "text", json: true, temperature: 0, maxTokens: 2000, task: "fatura_usina" },
    );
    return { leitura: parseJsonResponse<unknown>(raw) };
  } catch (err) {
    return { leitura: null, erro: err instanceof Error ? err.message : "falha" };
  }
}
