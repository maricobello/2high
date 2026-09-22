import "server-only";
import { db } from "@/modules/db";
import type { ProcessingStatus, SolutionCode } from "@/modules/leads/types";
import type { AuditResult } from "@/modules/rules-engine/types";

/**
 * Visão PÚBLICA do diagnóstico (acessada pelo token do lead).
 * Não expõe score numérico, dados comerciais, notas internas nem texto da fatura.
 */
export interface PublicDiagnostic {
  protocol: string;
  name: string;
  company: string | null;
  processingStatus: ProcessingStatus;
  hasInvoice: boolean;
  hot: boolean;
  createdAt: string;
  diagnostic: {
    summary: string;
    audit: AuditResult;
    findingTexts: Record<string, string>;
    history: { month: string; kwh: number }[];
    completeness: number | null;
    createdAt: string;
  } | null;
  solutions: SolutionCode[];
}

export async function getPublicDiagnostic(token: string): Promise<PublicDiagnostic | null> {
  if (!token || token.length < 16) return null;
  const lead = await db().getLeadByToken(token);
  if (!lead) return null;
  const [diag, inv] = await Promise.all([db().getLatestDiagnostic(lead.id), db().getLatestInvoice(lead.id)]);
  const processing = lead.processingStatus === "pending" || lead.processingStatus === "processing";
  return {
    protocol: lead.protocol,
    name: lead.name.split(" ")[0],
    company: lead.company,
    processingStatus: lead.processingStatus,
    hasInvoice: Boolean(inv),
    hot: lead.temperature === "HOT",
    createdAt: lead.createdAt,
    diagnostic:
      diag && !processing
        ? {
            summary: diag.summary,
            audit: diag.audit,
            findingTexts: diag.findingTexts ?? {},
            history: inv?.extracted?.history ?? [],
            completeness: inv?.validation?.completeness ?? null,
            createdAt: diag.createdAt,
          }
        : null,
    solutions: lead.recommendedSolutions,
  };
}
