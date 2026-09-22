import "server-only";
import { templateFollowUp, FOLLOW_UP_STEPS, type FollowUpContext } from "@/modules/notifications/templates";
import { SOLUTION_LABELS } from "@/modules/leads/types";
import { collectAllowedNumbers, guardGeneratedText } from "../guards";
import { getLLM, parseJsonResponse } from "../provider";

/* ---------------- Classificação de intenção ---------------- */

export const INTENTS = ["interessado", "agendar_reuniao", "duvida", "sem_interesse", "opt_out", "outro"] as const;
export type Intent = (typeof INTENTS)[number];

/** Classificador determinístico por palavras-chave (fallback e pré-filtro). */
export function classifyIntentByRules(message: string): Intent | null {
  const t = message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (/^\s*(sair|parar|stop|cancelar|descadastrar)\b/.test(t) || /nao (quero )?(receber|mande) mais/.test(t)) return "opt_out";
  if (/\b(agendar|reuniao|marcar|horario|amanha|call|ligacao|me liga)\b/.test(t)) return "agendar_reuniao";
  if (/\b(nao tenho interesse|sem interesse|nao preciso|ja resolvi)\b/.test(t)) return "sem_interesse";
  if (/\b(quero|tenho interesse|interessad|proposta|vamos|pode sim|sim\b)/.test(t)) return "interessado";
  if (/\?|como funciona|quanto custa|duvida/.test(t)) return "duvida";
  return null;
}

export async function classifyIntent(message: string): Promise<{ intent: Intent; source: "rules" | "llm" }> {
  const byRules = classifyIntentByRules(message);
  if (byRules === "opt_out") return { intent: byRules, source: "rules" };
  const llm = getLLM();
  if (!llm.available) return { intent: byRules ?? "outro", source: "rules" };
  try {
    const raw = await llm.chat(
      [
        {
          role: "system",
          content: `Classifique a intenção da mensagem de um potencial cliente B2B de soluções de energia. Responda JSON {"intent": uma de ${JSON.stringify(
            INTENTS,
          )}}. "opt_out" = pediu para não receber mensagens.`,
        },
        { role: "user", content: message.slice(0, 2000) },
      ],
      { tier: "fast", json: true, temperature: 0, maxTokens: 50 },
    );
    const parsed = parseJsonResponse<{ intent?: string }>(raw);
    const intent = INTENTS.find((i) => i === parsed?.intent);
    return intent ? { intent, source: "llm" } : { intent: byRules ?? "outro", source: "rules" };
  } catch {
    return { intent: byRules ?? "outro", source: "rules" };
  }
}

/* ---------------- Mensagens de follow-up ---------------- */

export async function generateFollowUpMessage(step: number, ctx: FollowUpContext): Promise<{ text: string; source: "llm" | "template" }> {
  const fallback = { text: templateFollowUp(step, ctx), source: "template" as const };
  const llm = getLLM();
  const def = FOLLOW_UP_STEPS.find((s) => s.step === step);
  if (!llm.available || !def) return fallback;

  const input = {
    primeiro_nome: ctx.name.split(" ")[0],
    empresa: ctx.company,
    protocolo: ctx.protocol,
    link_diagnostico: ctx.diagnosticUrl,
    solucao_principal: ctx.solutions[0] ? SOLUTION_LABELS[ctx.solutions[0]] : null,
    objetivo_da_mensagem: def.goal,
    passo: step,
  };
  try {
    const raw = await llm.chat(
      [
        {
          role: "system",
          content:
            'Você escreve mensagens curtas de WhatsApp/e-mail para leads B2B de uma energy-tech brasileira. Tom consultivo, cordial, sem pressão, sem emojis, no máximo 400 caracteres. Não cite valores em reais nem percentuais. Não prometa economia. Inclua o link e o protocolo exatamente como fornecidos. Responda JSON {"message": "..."}',
        },
        { role: "user", content: JSON.stringify(input) },
      ],
      { tier: "fast", json: true, temperature: 0.5, maxTokens: 300 },
    );
    const parsed = parseJsonResponse<{ message?: string }>(raw);
    const text = parsed?.message?.trim();
    if (!text || !text.includes(ctx.protocol)) return fallback;
    const g = guardGeneratedText(text.replace(ctx.diagnosticUrl, ""), collectAllowedNumbers(input));
    return g.ok ? { text, source: "llm" } : fallback;
  } catch {
    return fallback;
  }
}
