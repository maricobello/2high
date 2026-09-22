import "server-only";
import { brand } from "@/lib/brand";
import { formatBRL } from "@/lib/utils";
import { collectAllowedNumbers, guardGeneratedText } from "@/modules/llm/guards";
import { getLLM, parseJsonResponse, type ChatMessage } from "@/modules/llm/provider";
import type { AuditResult } from "@/modules/rules-engine/types";
import { knowledgeText, searchKnowledge, SERVICE_FACTS } from "./knowledge";

/**
 * Assistente de atendimento (site e WhatsApp).
 * - Responde só com base na base de conhecimento + diagnóstico do próprio lead.
 * - Toda resposta passa pelas guardas (sem números inventados, sem promessas).
 * - Sem IA configurada, responde por recuperação de FAQ.
 */
export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

export interface AssistantContext {
  firstName?: string | null;
  company?: string | null;
  hasInvoice?: boolean;
  diagnostic?: { summary: string; audit: AuditResult } | null;
  channel: "site" | "whatsapp";
}

export interface AssistantReply {
  reply: string;
  source: "llm" | "rules";
  handoff: boolean;
  suggestUpload: boolean;
  suggestions: string[];
}

const DEFAULT_SUGGESTIONS = ["É realmente gratuito?", "O que vocês analisam na conta?", "Preciso instalar placas?", "Falar com um especialista"];

function diagnosticContext(ctx: AssistantContext) {
  const d = ctx.diagnostic;
  if (!d) return null;
  const a = d.audit;
  return {
    resumo: d.summary,
    valor_fatura: a.metrics.totalAmount,
    consumo_kwh: a.metrics.consumptionKwh,
    perfil: a.metrics.profileLabel,
    distribuidora: a.metrics.distributor,
    achados: a.findings.map((f) => ({
      tipo: f.kind,
      titulo: f.title,
      explicacao: f.explanation,
      confianca: f.confidence,
      impacto_mensal_estimado: f.estimatedMonthlyImpact ?? null,
    })),
    gd: { avaliacao: a.gd.fitLabel, economia_min: a.gd.savingsMin, economia_max: a.gd.savingsMax },
    mercado_livre: { status: a.freeMarket.statusLabel, economia_min: a.freeMarket.savingsMin, economia_max: a.freeMarket.savingsMax },
  };
}

function systemPrompt(ctx: AssistantContext): string {
  const diag = diagnosticContext(ctx);
  return `Você é a assistente virtual de atendimento da ${brand.name}, plataforma brasileira de análise de contas de energia para empresas. Canal: ${ctx.channel === "whatsapp" ? "WhatsApp" : "chat do site"}.
Objetivo: tirar dúvidas com clareza e conduzir, sem pressão, para o próximo passo: ${ctx.hasInvoice ? "entender o Raio-X e, se quiser, falar com um especialista" : "enviar a fatura para a análise gratuita"}.

REGRAS OBRIGATÓRIAS:
- Português do Brasil, tom cordial e profissional, respostas curtas (até 4 frases). Sem emojis.
- Use SOMENTE as informações abaixo (fatos, FAQ e diagnóstico). Se não souber, diga que um especialista pode responder e ofereça o WhatsApp.
- NUNCA invente números, preços, percentuais ou prazos. Só cite valores que aparecem no diagnóstico ou nos fatos.
- Nunca garanta economia, nunca diga que a distribuidora está cobrando errado, nunca afirme que a empresa pode migrar com certeza. Use "estimativa", "possível", "pode ser avaliado", "sujeito à validação técnica".
- Não peça dados sensíveis (documentos pessoais, senhas, dados bancários). Para a análise, basta a fatura.
- Se a pessoa pedir humano, preço de proposta, contrato ou negociação: handoff=true.
- Se ainda não enviou a fatura e a conversa mostrar interesse: suggest_upload=true.

${knowledgeText()}
${ctx.firstName ? `\nNome do cliente: ${ctx.firstName}${ctx.company ? ` (${ctx.company})` : ""}.` : ""}
${diag ? `\nDIAGNÓSTICO PRELIMINAR DESTE CLIENTE (JSON):\n${JSON.stringify(diag)}` : ctx.hasInvoice ? "\nA fatura foi recebida e o diagnóstico está em processamento." : "\nO cliente ainda não enviou a fatura."}

Responda em JSON: {"reply": "texto", "handoff": boolean, "suggest_upload": boolean, "suggestions": ["até 3 perguntas curtas que o cliente pode fazer a seguir"]}`;
}

export async function answer(history: AssistantTurn[], ctx: AssistantContext): Promise<AssistantReply> {
  const turns = history.slice(-10).map((t) => ({ role: t.role, content: t.content.slice(0, 1200) }));
  const last = [...turns].reverse().find((t) => t.role === "user")?.content ?? "";
  const llm = getLLM();
  if (!llm.available) return ruleBasedAnswer(last, ctx);

  const allowed = collectAllowedNumbers([SERVICE_FACTS, knowledgeText(), diagnosticContext(ctx), turns.filter((t) => t.role === "user").map((t) => t.content)]);
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt(ctx) }, ...turns];

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const raw = await llm.chat(messages, { tier: "text", json: true, temperature: 0.3, maxTokens: 500 });
      const parsed = parseJsonResponse<{ reply?: string; handoff?: boolean; suggest_upload?: boolean; suggestions?: string[] }>(raw);
      const reply = parsed?.reply?.trim();
      if (!reply) continue;
      const g = guardGeneratedText(reply, allowed);
      if (!g.ok) {
        messages.push({ role: "assistant", content: raw }, { role: "user", content: `Reescreva sem: ${g.reasons.join("; ")}. Mantenha o formato JSON.` });
        continue;
      }
      return {
        reply,
        source: "llm",
        handoff: Boolean(parsed?.handoff),
        suggestUpload: Boolean(parsed?.suggest_upload) && !ctx.hasInvoice,
        suggestions: (parsed?.suggestions ?? []).filter((s) => typeof s === "string" && s.length < 80).slice(0, 3),
      };
    } catch (err) {
      console.warn("[assistant] IA indisponível:", err instanceof Error ? err.message : err);
      break;
    }
  }
  return ruleBasedAnswer(last, ctx);
}

/** Atendimento sem IA: intenção por palavras-chave + FAQ + diagnóstico. */
export function ruleBasedAnswer(question: string, ctx: AssistantContext): AssistantReply {
  const q = question.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const base = { source: "rules" as const, suggestUpload: !ctx.hasInvoice, suggestions: DEFAULT_SUGGESTIONS.slice(0, 3) };

  if (/(humano|atendente|especialista|pessoa|consultor|whatsapp|ligar|telefone|proposta|contrato|preco|valor da proposta)/.test(q)) {
    return { ...base, handoff: true, reply: "Claro! Um especialista pode continuar o atendimento pelo WhatsApp. É só tocar no botão abaixo." };
  }
  if (ctx.diagnostic && /(resultado|diagnostico|raio|minha conta|minha fatura|economia|oportunidade|ponto)/.test(q)) {
    const a = ctx.diagnostic.audit;
    const opp = a.findings.filter((f) => f.kind === "opportunity").map((f) => f.title);
    const att = a.findings.filter((f) => f.kind === "attention").map((f) => f.title);
    const parts = [
      `Seu Raio-X considerou uma fatura de ${formatBRL(a.metrics.totalAmount)} (${a.metrics.profileLabel}).`,
      att.length ? `Pontos de atenção: ${att.join("; ")}.` : "",
      opp.length ? `Oportunidades para avaliar: ${opp.join("; ")}.` : "",
      "São resultados preliminares, sujeitos à validação técnica. Quer que um especialista explique em detalhe?",
    ];
    return { ...base, handoff: false, suggestUpload: false, reply: parts.filter(Boolean).join(" ") };
  }
  if (/^(oi|ola|bom dia|boa tarde|boa noite|e ai|opa)\b/.test(q.trim())) {
    return {
      ...base,
      handoff: false,
      reply: `Olá${ctx.firstName ? `, ${ctx.firstName}` : ""}! Sou a assistente da ${brand.name}. Posso explicar como funciona a análise gratuita da fatura, GD por assinatura, Mercado Livre ou o seu Raio-X. Como posso ajudar?`,
    };
  }
  if (/(enviar|mandar|upload|anexar|foto).*(fatura|conta)|como (faco|comeco)/.test(q)) {
    return {
      ...base,
      handoff: false,
      suggestUpload: !ctx.hasInvoice,
      reply: ctx.hasInvoice
        ? "Sua fatura já foi recebida. O Raio-X aparece na página do seu diagnóstico assim que o processamento termina."
        : "É simples: informe nome, e-mail e WhatsApp e depois envie o PDF da fatura ou uma foto nítida (até 4 MB). O Raio-X costuma ficar pronto em até 1 minuto.",
    };
  }
  const hit = searchKnowledge(question);
  if (hit) return { ...base, handoff: false, reply: hit.a };
  return {
    ...base,
    handoff: true,
    reply: "Não tenho certeza sobre isso. Posso chamar um especialista pelo WhatsApp para te responder com precisão, ou você pode enviar a fatura para a análise gratuita.",
  };
}
