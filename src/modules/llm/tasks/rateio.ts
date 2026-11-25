import "server-only";
import { parecerPadrao, type ResumoParecer } from "@/modules/rateio/parecer";
import { collectAllowedNumbers, guardGeneratedText } from "../guards";
import { getLLM, parseJsonResponse } from "../provider";

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
