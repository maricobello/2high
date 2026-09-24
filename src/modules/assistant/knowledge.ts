import { FAQ } from "@/content/faq";

/**
 * Base de conhecimento da assistente de atendimento. Tudo que ela pode afirmar
 * sobre o serviço está aqui ou no diagnóstico do próprio lead.
 */
export const SERVICE_FACTS = [
  "A análise preliminar da fatura é gratuita e sem compromisso.",
  "Para fazer a análise: informar nome, e-mail e WhatsApp e depois enviar a fatura (PDF da distribuidora ou foto nítida, até 4 MB). O Raio-X costuma ficar pronto em até 1 minuto.",
  "O Raio-X mostra: valor da fatura, consumo, perfil (Grupo A ou B), pontos de atenção, análises recomendadas, oportunidades e soluções potenciais, cada item com dados usados e nível de confiança.",
  "Verificações feitas: ultrapassagem de demanda, demanda contratada, energia reativa/fator de potência, estrutura tarifária, variações anormais de consumo, créditos de compensação, GD por assinatura e perfil para Mercado Livre.",
  "Os cálculos são feitos por um motor de regras técnico; a IA só lê o documento e explica os resultados.",
  "Todas as estimativas são preliminares e sujeitas à validação técnica, regulatória e comercial. Não há garantia de economia.",
  "GD por assinatura: energia gerada em usinas remotas, com créditos compensados na conta; não exige obra nem equipamento; depende de disponibilidade na distribuidora e do perfil.",
  "Mercado Livre: desde 2024 unidades do Grupo A (média/alta tensão) podem migrar; abaixo de 500 kW, via comercializador varejista. Baixa tensão (Grupo B) ainda depende de regulamentação.",
  "Dados pessoais são tratados conforme a LGPD: uso para a análise e o contato autorizado, armazenamento privado, e o titular pode pedir acesso, correção ou exclusão na página /privacidade/solicitacao.",
  "Recuperação de valores: o Código de Defesa do Consumidor (art. 42, parágrafo único) prevê a devolução em dobro, com correção e juros, do que foi cobrado indevidamente, salvo engano justificável; a REN ANEEL 1.000/2021 regula o faturamento e a devolução de valores cobrados a maior pela distribuidora.",
  "O pedido de devolução pode alcançar as últimas 60 faturas (5 anos), prazo usado como referência pela Justiça. Ele é feito administrativamente, direto com a distribuidora (e, se preciso, ouvidoria e ANEEL), sem ação judicial. A empresa cuida de todo o processo pelo cliente. O resultado depende da comprovação da cobrança indevida; não há garantia de valores.",
  "Oferecemos gestão completa de energia, simples e digital, com profissionais do setor elétrico: auditoria das faturas, recuperação de valores, GD por assinatura e Mercado Livre.",
  "Modelo de cobrança por êxito: diagnóstico e auditoria são gratuitos; se houver valor a recuperar, a empresa cuida de todo o processo e cobra apenas uma porcentagem do que for efetivamente recuperado, combinada em contrato. Sem mensalidade, sem custo inicial; se nada for recuperado, o cliente não paga.",
  "Laudo de crédito de ICMS: indústrias podem se creditar do ICMS da energia consumida no processo produtivo (LC 87/96, art. 33), com laudo técnico que mede a parcela da produção; pode alcançar os últimos 5 anos; regras variam por estado. No Grupo A, o ICMS só incide sobre a demanda efetivamente utilizada (Súmula 391 do STJ).",
  "Um especialista humano pode continuar o atendimento pelo WhatsApp quando o cliente quiser.",
  "Para parar de receber mensagens automáticas, basta responder SAIR no WhatsApp.",
];

export function knowledgeText(): string {
  return [
    "FATOS DO SERVIÇO:",
    ...SERVICE_FACTS.map((f) => `- ${f}`),
    "",
    "PERGUNTAS FREQUENTES:",
    ...FAQ.map((f) => `P: ${f.q}\nR: ${f.a}`),
  ].join("\n");
}

/** Recuperação simples por palavras-chave (usada sem IA e como apoio). */
export function searchKnowledge(question: string): { q: string; a: string } | null {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const words = norm(question)
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 3);
  if (!words.length) return null;
  let best: { q: string; a: string; score: number } | null = null;
  for (const f of FAQ) {
    const hay = norm(`${f.q} ${f.q} ${f.a}`);
    const score = words.reduce((acc, w) => acc + (hay.includes(w) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { ...f, score };
  }
  return best && best.score >= 1 ? { q: best.q, a: best.a } : null;
}
