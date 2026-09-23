import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db, type LeadRecord } from "@/modules/db";
import { changeStage, createLead } from "@/modules/crm/service";
import { ACCEPTED_MIME, sniffMime } from "@/modules/ocr";
import { storage } from "@/modules/storage";
import { CONSENT_VERSION, type HeroLeadInput, type QuickLeadInput } from "./schema";
import { stageIndex, type BillRange, type IntentSignal, type LeadSource } from "./types";

export const MAX_UPLOAD_BYTES = 4_400_000; // limite de corpo das funções da Vercel (~4,5 MB)

export class IntakeError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export interface UploadedFile {
  name: string;
  type: string;
  bytes: Buffer;
}

/** Valida o arquivo pelo conteúdo real (assinatura), não pela extensão. */
export function validateUpload(file: UploadedFile) {
  if (file.bytes.length === 0) throw new IntakeError("Arquivo vazio.");
  if (file.bytes.length > MAX_UPLOAD_BYTES) throw new IntakeError("Arquivo maior que 4 MB. Envie um PDF ou uma foto com menor resolução.", 413);
  const sniffed = sniffMime(file.bytes);
  if (!sniffed || !ACCEPTED_MIME.includes(sniffed)) throw new IntakeError("Formato não suportado. Envie PDF, JPG, PNG ou WEBP.", 415);
  return sniffed;
}

/** Cria o lead a partir do formulário do hero e armazena a fatura (etapas 1 e 8). */
export async function intakeHeroLead(input: HeroLeadInput, file: UploadedFile | null): Promise<LeadRecord> {
  const mime = file ? validateUpload(file) : null;
  const signals: IntentSignal[] = file ? ["uploaded_invoice"] : [];

  const lead = await createLead({
    name: input.name,
    company: input.company,
    cnpj: input.cnpj || null,
    phone: input.phone,
    email: input.email,
    state: input.state,
    city: input.city,
    billRange: input.billRange,
    solarStatus: input.solarStatus,
    freeMarketStatus: input.freeMarketStatus,
    source: "hero_form",
    stage: "novo_lead",
    score: null,
    temperature: null,
    scoreBreakdown: null,
    processingStatus: file ? "pending" : "no_invoice",
    processingError: null,
    recommendedSolutions: [],
    opportunities: [],
    potentialValue: null,
    potentialCommission: null,
    partnerId: null,
    owner: null,
    notes: null,
    intentSignals: signals,
    followUpOptOut: false,
    consentAt: new Date().toISOString(),
    marketingConsent: input.marketingConsent ?? false,
    utm: input.utm ?? null,
  });

  if (file && mime) {
    await attachInvoice(lead, file, mime);
  }
  return lead;
}

export async function attachInvoice(lead: LeadRecord, file: UploadedFile, mime: string) {
  const sha256 = createHash("sha256").update(file.bytes).digest("hex");
  const ext = mime === "application/pdf" ? "pdf" : mime.split("/")[1];
  const key = `${new Date().toISOString().slice(0, 7)}/${lead.id}/${randomUUID()}.${ext}`;
  await storage().save(key, file.bytes, mime);
  const inv = await db().createInvoice({
    leadId: lead.id,
    storagePath: key,
    fileName: file.name.slice(0, 200) || `fatura.${ext}`,
    mimeType: mime,
    sizeBytes: file.bytes.length,
    sha256,
    status: "received",
    ocrProvider: null,
    ocrText: null,
    extracted: null,
    fieldMeta: null,
    validation: null,
    extractionMethod: null,
  });
  await db().addActivity({
    leadId: lead.id,
    type: "system",
    channel: "upload",
    content: `Fatura recebida: ${inv.fileName} (${Math.round(inv.sizeBytes / 1024)} KB).`,
    meta: { invoiceId: inv.id, sha256 },
    author: "sistema",
  });
  // Não rebaixa leads que já avançaram no funil (ex.: "proposta")
  const current = await db().getLead(lead.id);
  if (current && stageIndex(current.stage) < stageIndex("fatura_recebida")) await changeStage(lead.id, "fatura_recebida");
  return inv;
}

/** Leads vindos dos simuladores (GD / Mercado Livre). */
export async function intakeSimulatorLead(input: {
  contact: Omit<HeroLeadInput, "billRange" | "solarStatus" | "freeMarketStatus" | "consent" | "website">;
  source: Extract<LeadSource, "gd_simulator" | "ml_simulator">;
  billRange: BillRange | null;
  signals: IntentSignal[];
}): Promise<LeadRecord> {
  return createLead({
    name: input.contact.name,
    company: input.contact.company,
    cnpj: input.contact.cnpj || null,
    phone: input.contact.phone,
    email: input.contact.email,
    state: input.contact.state,
    city: input.contact.city,
    billRange: input.billRange,
    solarStatus: null,
    freeMarketStatus: null,
    source: input.source,
    stage: "novo_lead",
    score: null,
    temperature: null,
    scoreBreakdown: null,
    processingStatus: "no_invoice",
    processingError: null,
    recommendedSolutions: [],
    opportunities: [],
    potentialValue: null,
    potentialCommission: null,
    partnerId: null,
    owner: null,
    notes: null,
    intentSignals: input.signals,
    followUpOptOut: false,
    consentAt: new Date().toISOString(),
    marketingConsent: input.contact.marketingConsent ?? false,
    utm: input.contact.utm ?? null,
  });
}

export function billRangeFromAmount(amount: number | null | undefined): BillRange | null {
  if (!amount) return null;
  if (amount <= 1000) return "ate_1k";
  if (amount <= 4000) return "1k_4k";
  if (amount <= 10000) return "4k_10k";
  if (amount <= 50000) return "10k_50k";
  return "50k_mais";
}

/** Etapa 1: cria o lead apenas com contato + registro do consentimento (LGPD). */
export async function intakeQuickLead(input: QuickLeadInput, ctx: { ipHash: string | null; userAgent: string | null }): Promise<LeadRecord> {
  const lead = await createLead({
    name: input.name,
    company: input.company || null,
    cnpj: null,
    phone: input.phone,
    email: input.email,
    state: null,
    city: null,
    billRange: null,
    solarStatus: null,
    freeMarketStatus: null,
    source: "hero_form",
    stage: "novo_lead",
    score: null,
    temperature: null,
    scoreBreakdown: null,
    processingStatus: "no_invoice",
    processingError: null,
    recommendedSolutions: [],
    opportunities: [],
    potentialValue: null,
    potentialCommission: null,
    partnerId: null,
    owner: null,
    notes: null,
    intentSignals: [],
    followUpOptOut: false,
    consentAt: new Date().toISOString(),
    marketingConsent: input.marketingConsent ?? false,
    utm: input.utm ?? null,
  });
  await recordConsent(lead.id, { marketing: input.marketingConsent ?? false, ...ctx });
  return lead;
}

/** Evidência do consentimento: versão do texto, data, IP (hash) e navegador. */
export async function recordConsent(leadId: string, ctx: { marketing: boolean; ipHash: string | null; userAgent: string | null }) {
  await db().addActivity({
    leadId,
    type: "system",
    channel: "lgpd",
    content: `Consentimento registrado (política v${CONSENT_VERSION}; marketing: ${ctx.marketing ? "sim" : "não"}).`,
    meta: { consentVersion: CONSENT_VERSION, marketing: ctx.marketing, ipHash: ctx.ipHash, userAgent: ctx.userAgent?.slice(0, 200) ?? null },
    author: "lead",
  });
}

export function hashIp(ip: string): string | null {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(`${ip}:${process.env.AUTH_SECRET ?? ""}`).digest("hex").slice(0, 24);
}
