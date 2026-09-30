import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseInvoiceText } from "../../src/modules/invoice/regex-parser";
import { runAudit } from "../../src/modules/rules-engine/engine";
import type { AiUsageRecord, DiagnosticRecord, InvoiceRecord, LeadRecord } from "../../src/modules/db/types";

/**
 * Semeia no banco local (.data/db.json, driver "local") um lead com relatório pronto
 * (fatura de teste do Grupo A + 12 meses de histórico) e registros de uso da IA.
 * O servidor relê o arquivo quando ele muda, então funciona com o servidor já no ar.
 */
export const REPORT_TOKEN = "e2e-report-token-0123456789";
export const REPORT_PROTOCOL = "AF-E2E-0001";
export const REPORT_COMPANY = "Metalúrgica Exemplo E2E Ltda";

export function seedReport() {
  const file = path.resolve(process.env.LOCAL_DATA_DIR || ".data", "db.json");
  let store: Record<string, unknown[]> = {};
  try {
    store = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    /* banco local ainda não existe */
  }
  const leads = (store.leads ?? []) as LeadRecord[];
  const old = leads.find((l) => l.accessToken === REPORT_TOKEN);
  if (old) return;

  const now = new Date();
  const iso = now.toISOString();
  const inv = parseInvoiceText(readFileSync(path.resolve("tests/fixtures/fatura-grupo-a.txt"), "utf8")).data;
  inv.history = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(2025, 9 + i, 1));
    return { month: d.toISOString().slice(0, 7), kwh: Math.round(52000 + Math.sin(i / 1.7) * 6000 + i * 350) };
  });
  const audit = runAudit({ invoice: inv, lead: { billRange: "10k_50k", solarStatus: "nao", freeMarketStatus: "nao_sei", state: "MG", city: "Contagem" }, now });

  const lead: LeadRecord = {
    id: randomUUID(),
    protocol: REPORT_PROTOCOL,
    accessToken: REPORT_TOKEN,
    name: "Teste E2E",
    company: REPORT_COMPANY,
    cnpj: null,
    phone: "11999999999",
    email: "e2e@example.com",
    state: "MG",
    city: "Contagem",
    billRange: "10k_50k",
    solarStatus: "nao",
    freeMarketStatus: "nao_sei",
    source: "hero_form",
    stage: "auditoria_concluida",
    score: 80,
    temperature: "HOT",
    scoreBreakdown: null,
    processingStatus: "done",
    processingError: null,
    recommendedSolutions: audit.solutions,
    opportunities: [],
    potentialValue: null,
    potentialCommission: null,
    partnerId: null,
    owner: null,
    notes: null,
    intentSignals: ["uploaded_invoice"],
    followUpOptOut: false,
    consentAt: iso,
    marketingConsent: false,
    utm: null,
    createdAt: iso,
    updatedAt: iso,
  };
  const invoice: InvoiceRecord = {
    id: randomUUID(),
    leadId: lead.id,
    storagePath: "e2e",
    fileName: "fatura.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1000,
    sha256: "e2e",
    status: "processed",
    ocrProvider: "pdf-text",
    ocrText: null,
    extracted: inv,
    fieldMeta: null,
    validation: { completeness: 0.92 } as InvoiceRecord["validation"],
    extractionMethod: "regex",
    createdAt: iso,
    updatedAt: iso,
  };
  const diagnostic: DiagnosticRecord = {
    id: randomUUID(),
    leadId: lead.id,
    invoiceId: invoice.id,
    audit,
    summary: "A leitura da fatura mostra uma conta do Grupo A com sinais de ultrapassagem de demanda e cobrança de energia reativa.",
    summarySource: "template",
    findingTexts: {},
    engineVersion: audit.engineVersion,
    createdAt: iso,
  };
  const usage: AiUsageRecord[] = ["leitura_fatura_texto", "explicacao_relatorio", "assistente_chat"].map((task, i) => ({
    id: randomUUID(),
    createdAt: iso,
    leadId: task === "assistente_chat" ? null : lead.id,
    task,
    provider: "groq",
    model: "modelo-e2e",
    ok: i !== 1,
    latencyMs: 1200 + i * 300,
    attempts: 1,
    promptTokens: 900,
    completionTokens: 300,
    totalTokens: 1200,
    error: i === 1 ? "LLM 429: rate limit exceeded" : null,
  }));

  store.leads = [...leads, lead];
  store.invoices = [...(store.invoices ?? []), invoice];
  store.diagnostics = [...(store.diagnostics ?? []), diagnostic];
  store.aiUsage = [...usage, ...(store.aiUsage ?? [])];
  mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.e2e.tmp`;
  writeFileSync(tmp, JSON.stringify(store));
  renameSync(tmp, file);
}
