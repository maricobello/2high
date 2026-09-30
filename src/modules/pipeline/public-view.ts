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
    /** Dados da fatura para o cabeçalho do relatório (unidade mascarada). */
    invoice: { consumerUnit: string | null; periodStart: string | null; periodEnd: string | null } | null;
  } | null;
  solutions: SolutionCode[];
}

/** O link do relatório pode ser encaminhado: mostra só os 4 últimos dígitos da unidade. */
function maskUnit(unit: string | null): string | null {
  const digits = unit?.replace(/\D/g, "") ?? "";
  return digits.length >= 4 ? `•••${digits.slice(-4)}` : null;
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
            invoice: inv?.extracted
              ? {
                  consumerUnit: maskUnit(inv.extracted.consumerUnit),
                  periodStart: inv.extracted.billingPeriodStart,
                  periodEnd: inv.extracted.billingPeriodEnd,
                }
              : null,
          }
        : null,
    solutions: lead.recommendedSolutions,
  };
}
