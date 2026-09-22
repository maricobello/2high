import "server-only";
import { randomBytes } from "node:crypto";
import { brand } from "@/lib/brand";
import { env } from "@/lib/env";
import { db, type LeadRecord, type NewLead } from "@/modules/db";
import { isHumanHandled, stageLabel, type IntentSignal, type Stage } from "@/modules/leads/types";
import { scoreLead } from "@/modules/scoring/score";
import { sendWebhook } from "@/modules/notifications/channels";

/** Serviço de CRM: criação de leads, mudanças de estágio, sinais de intenção e rescoring. */

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateProtocol(date = new Date()): string {
  const prefix = brand.name.replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "EN";
  const ymd = date.toISOString().slice(2, 10).replace(/-/g, "");
  const bytes = randomBytes(5);
  const suffix = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join("");
  return `${prefix}-${ymd}-${suffix}`;
}

export function generateAccessToken(): string {
  return randomBytes(24).toString("base64url");
}

export function diagnosticUrl(lead: Pick<LeadRecord, "accessToken">): string {
  return `${env.appUrl}/diagnostico/${lead.accessToken}`;
}

export async function createLead(input: Omit<NewLead, "protocol" | "accessToken">): Promise<LeadRecord> {
  const lead = await db().createLead({ ...input, protocol: generateProtocol(), accessToken: generateAccessToken() });
  await db().addActivity({
    leadId: lead.id,
    type: "system",
    channel: null,
    content: `Lead criado via ${lead.source}. Protocolo ${lead.protocol}.`,
    meta: { source: lead.source, utm: lead.utm },
    author: "sistema",
  });
  return lead;
}

export async function changeStage(leadId: string, stage: Stage, author = "sistema", reason?: string): Promise<LeadRecord> {
  const current = await db().getLead(leadId);
  if (!current) throw new Error("Lead não encontrado");
  if (current.stage === stage) return current;
  const updated = await db().updateLead(leadId, { stage });
  await db().addActivity({
    leadId,
    type: "stage_change",
    channel: null,
    content: `${stageLabel(current.stage)} → ${stageLabel(stage)}${reason ? ` (${reason})` : ""}`,
    meta: { from: current.stage, to: stage },
    author,
  });
  if (isHumanHandled(stage)) await db().cancelFollowUps(leadId);
  void emitLeadEvent("lead.stage_changed", updated);
  return updated;
}

/** Registra sinal de intenção e recalcula o score com o último diagnóstico. */
export async function addIntentSignal(leadId: string, signal: IntentSignal): Promise<LeadRecord | null> {
  const lead = await db().getLead(leadId);
  if (!lead) return null;
  if (lead.intentSignals.includes(signal)) return lead;
  const intentSignals = [...lead.intentSignals, signal];
  return rescoreLead({ ...lead, intentSignals }, `sinal: ${signal}`);
}

export async function rescoreLead(lead: LeadRecord, reason: string): Promise<LeadRecord> {
  const diag = await db().getLatestDiagnostic(lead.id);
  const inv = await db().getLatestInvoice(lead.id);
  const s = scoreLead({
    billRange: lead.billRange,
    audit: diag?.audit ?? null,
    completeness: inv?.validation?.completeness ?? null,
    intentSignals: lead.intentSignals,
    hasInvoice: Boolean(inv),
  });
  const updated = await db().updateLead(lead.id, {
    intentSignals: lead.intentSignals,
    score: s.score,
    temperature: s.temperature,
    scoreBreakdown: s.components,
  });
  if (lead.score !== s.score) {
    await db().addActivity({
      leadId: lead.id,
      type: "score_change",
      channel: null,
      content: `Score ${lead.score ?? "—"} → ${s.score} (${s.temperature}) — ${reason}`,
      meta: null,
      author: "sistema",
    });
  }
  // Promoção automática: lead HOT/WARM em estágio inicial vira "qualificado"
  const processing = updated.processingStatus === "pending" || updated.processingStatus === "processing";
  if (!processing && (s.temperature === "HOT" || s.temperature === "WARM") && ["novo_lead", "auditoria_concluida"].includes(updated.stage)) {
    return changeStage(lead.id, "qualificado", "sistema", `score ${s.temperature}`);
  }
  return updated;
}

/** Evento para integrações externas (CRM, n8n, BI). Nunca inclui o texto da fatura. */
export async function emitLeadEvent(event: string, lead: LeadRecord, extra: Record<string, unknown> = {}) {
  if (!env.crmWebhookUrl) return;
  await sendWebhook({ leadId: lead.id, url: env.crmWebhookUrl, event, data: { lead: publicLeadPayload(lead), ...extra } });
}

export function publicLeadPayload(lead: LeadRecord) {
  return {
    id: lead.id,
    protocol: lead.protocol,
    name: lead.name,
    company: lead.company,
    cnpj: lead.cnpj,
    phone: lead.phone,
    email: lead.email,
    state: lead.state,
    city: lead.city,
    billRange: lead.billRange,
    source: lead.source,
    stage: lead.stage,
    score: lead.score,
    temperature: lead.temperature,
    recommendedSolutions: lead.recommendedSolutions,
    opportunities: lead.opportunities,
    potentialValue: lead.potentialValue,
    potentialCommission: lead.potentialCommission,
    diagnosticUrl: diagnosticUrl(lead),
    createdAt: lead.createdAt,
  };
}
