import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "@/modules/db";

/**
 * Registro do uso da IA (painel /admin/ia). Guarda só metadados da chamada:
 * tarefa, modelo, tokens, tempo e erro. Nunca o conteúdo da fatura ou da conversa.
 */
const ctx = new AsyncLocalStorage<{ leadId: string | null }>();

/** Executa `fn` associando as chamadas de IA feitas dentro dela a um lead. */
export function withAiContext<T>(leadId: string | null, fn: () => Promise<T>): Promise<T> {
  return ctx.run({ leadId }, fn);
}

export interface UsageSample {
  task: string;
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  attempts: number;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } | null;
  error?: string | null;
}

export async function recordAiUsage(s: UsageSample): Promise<void> {
  try {
    await db().addAiUsage({
      leadId: ctx.getStore()?.leadId ?? null,
      task: s.task,
      provider: s.provider,
      model: s.model,
      ok: s.ok,
      latencyMs: Math.round(s.latencyMs),
      attempts: s.attempts,
      promptTokens: s.usage?.prompt_tokens ?? null,
      completionTokens: s.usage?.completion_tokens ?? null,
      totalTokens: s.usage?.total_tokens ?? null,
      // mensagem curta, sem conteúdo enviado ao modelo
      error: s.error ? s.error.replace(/Bearer\s+\S+/gi, "Bearer ***").slice(0, 200) : null,
    });
  } catch (err) {
    // o registro nunca pode derrubar a análise
    console.warn("[ai-usage] não registrado:", err instanceof Error ? err.message : err);
  }
}
