import "server-only";
import type { AuditResult } from "@/modules/rules-engine/types";
import { templateExecutiveSummary } from "@/modules/notifications/templates";
import { collectAllowedNumbers, guardGeneratedText } from "../guards";
import { getLLM, parseJsonResponse } from "../provider";

/**
 * IA como EXPLICADORA: recebe resultados já calculados pelo motor determinístico
 * e reescreve em linguagem simples. Toda saída passa pelas guardas; se reprovar,
 * usamos o texto padrão.
 */
export interface Explanation {
  summary: string;
  summarySource: "llm" | "template";
  findingTexts: Record<string, string>;
  guardFailures: string[];
}

const SYSTEM = `Você é um consultor de energia que explica diagnósticos para empresários brasileiros, em português do Brasil, com linguagem simples e profissional.
Regras obrigatórias:
- Use SOMENTE os números fornecidos no JSON de entrada. Não calcule, não arredonde de forma diferente e não crie novos valores.
- Nunca afirme erro, fraude ou garantia. Use termos como "possível", "ponto de atenção", "oportunidade identificada", "estimativa", "sujeito à validação técnica".
- Não diga que a empresa é elegível; diga que o perfil pode ser avaliado.
- Frases curtas. Sem emojis. Sem jargão sem explicação.
Responda em JSON: {"summary": "resumo executivo de 3 a 5 frases", "findings": {"<code>": "explicação simples de 1 a 3 frases"}}`;

export async function explainAudit(audit: AuditResult, ctx: { company: string | null }): Promise<Explanation> {
  const fallback: Explanation = {
    summary: templateExecutiveSummary(audit, ctx.company),
    summarySource: "template",
    findingTexts: {},
    guardFailures: [],
  };
  const llm = getLLM();
  if (!llm.available) return fallback;

  const payload = {
    empresa: ctx.company,
    metricas: audit.metrics,
    contagens: audit.counts,
    achados: audit.findings.map((f) => ({
      code: f.code,
      tipo: f.kind,
      titulo: f.title,
      explicacao_tecnica: f.explanation,
      dados: f.dataUsed,
      confianca: f.confidence,
      impacto_mensal_estimado: f.estimatedMonthlyImpact ?? null,
    })),
    solucoes: audit.solutions,
  };
  const allowed = collectAllowedNumbers(payload);

  try {
    const raw = await llm.chat(
      [
        { role: "system", content: SYSTEM },
        { role: "user", content: JSON.stringify(payload) },
      ],
      { tier: "text", json: true, temperature: 0.3, maxTokens: 1400 },
    );
    const parsed = parseJsonResponse<{ summary?: string; findings?: Record<string, string> }>(raw);
    if (!parsed) return fallback;

    const failures: string[] = [];
    let summary = fallback.summary;
    let summarySource: Explanation["summarySource"] = "template";
    if (parsed.summary) {
      const g = guardGeneratedText(parsed.summary, allowed);
      if (g.ok) {
        summary = parsed.summary.trim();
        summarySource = "llm";
      } else failures.push(...g.reasons.map((r) => `summary: ${r}`));
    }
    const findingTexts: Record<string, string> = {};
    const validCodes = new Set(audit.findings.map((f) => f.code));
    for (const [code, text] of Object.entries(parsed.findings ?? {})) {
      if (!validCodes.has(code) || typeof text !== "string") continue;
      const g = guardGeneratedText(text, allowed);
      if (g.ok) findingTexts[code] = text.trim();
      else failures.push(...g.reasons.map((r) => `${code}: ${r}`));
    }
    return { summary, summarySource, findingTexts, guardFailures: failures };
  } catch (err) {
    console.warn("[llm] explicação indisponível:", err instanceof Error ? err.message : err);
    return fallback;
  }
}
