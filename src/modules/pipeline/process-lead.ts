import "server-only";
import { db, type InvoiceRecord, type LeadRecord } from "@/modules/db";
import { changeStage } from "@/modules/crm/service";
import { stageIndex } from "@/modules/leads/types";
import { mergeExtractions, normalize } from "@/modules/invoice/merge";
import { looksLikeEnergyBill, parseInvoiceText } from "@/modules/invoice/regex-parser";
import type { ExtractionResult, FieldMetaMap, InvoiceData, ValidationResult } from "@/modules/invoice/types";
import { validateInvoice } from "@/modules/invoice/validate";
import { explainAudit } from "@/modules/llm/tasks/explain";
import { extractInvoiceWithLLM, extractInvoiceWithVision } from "@/modules/llm/tasks/extract-invoice";
import { extractText, type AcceptedMime } from "@/modules/ocr";
import { runAudit } from "@/modules/rules-engine/engine";
import { scoreLead } from "@/modules/scoring/score";
import { storage } from "@/modules/storage";
import { runPostDiagnosisAutomation } from "@/modules/notifications/automation";

/**
 * PIPELINE DE AUDITORIA
 *
 *  UPLOAD → OCR/PARSER → VALIDAÇÃO → EXTRAÇÃO → MOTOR DE REGRAS → ANÁLISE
 *        → SCORE → RELATÓRIO → QUALIFICAÇÃO COMERCIAL → AUTOMAÇÃO
 *
 * Cada etapa registra atividade no lead. Falhas em etapas de IA/OCR degradam
 * para o caminho determinístico — o lead SEMPRE recebe um diagnóstico.
 */
export interface ProcessOptions {
  /**
   * Reprocessamento manual (painel): recalcula o diagnóstico sem reenviar
   * confirmação ao cliente nem reagendar follow-ups.
   */
  silent?: boolean;
}

export async function processLead(leadId: string, opts: ProcessOptions = {}): Promise<void> {
  try {
    await runPipeline(leadId, opts);
  } catch (err) {
    // Nunca deixa o lead preso em "processing": a página do diagnóstico e novos envios dependem disso.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[pipeline] falha geral", err);
    try {
      await db().updateLead(leadId, { processingStatus: "failed", processingError: message.slice(0, 500) });
      await db().addActivity({ leadId, type: "system", channel: "pipeline", content: `Falha no processamento: ${message.slice(0, 300)}`, meta: null, author: "pipeline" });
    } catch (inner) {
      console.error("[pipeline] não foi possível registrar a falha", inner);
    }
    throw err;
  }
}

async function runPipeline(leadId: string, opts: ProcessOptions): Promise<void> {
  const repo = db();
  const lead = await repo.getLead(leadId);
  if (!lead) throw new Error(`Lead ${leadId} não encontrado`);
  const invoice = await repo.getLatestInvoice(leadId);
  const t0 = Date.now();
  const step = (content: string, meta?: Record<string, unknown>) =>
    repo.addActivity({ leadId, type: "system", channel: "pipeline", content, meta: meta ?? null, author: "pipeline" });

  await repo.updateLead(leadId, { processingStatus: "processing", processingError: null });
  // Só avança o funil de leads em estágio inicial; nunca rebaixa um lead já em negociação
  if (invoice && stageIndex(lead.stage) < stageIndex("auditoria_processando")) await changeStage(leadId, "auditoria_processando");

  let extracted: InvoiceData | null = null;
  let validation: ValidationResult | null = null;
  let extractionConfidence: number | undefined;
  let pipelineError: string | null = null;

  if (invoice) {
    try {
      const r = await extractInvoice(invoice, step);
      extracted = r.data;
      validation = r.validation;
      extractionConfidence = averageConfidence(r.meta);
      await repo.updateInvoice(invoice.id, {
        status: "processed",
        extracted: r.data,
        fieldMeta: r.meta,
        validation: r.validation,
        extractionMethod: r.method,
        ocrProvider: r.ocrProvider,
        ocrText: r.text ? r.text.slice(0, 60000) : null,
      });
      await step(
        `Extração concluída (${r.method}). Completude ${Math.round(r.validation.completeness * 100)}%, ${r.validation.issues.length} observações de validação.`,
        { issues: r.validation.issues },
      );
      if (!r.validation.usable) extracted = null;
    } catch (err) {
      pipelineError = err instanceof Error ? err.message : String(err);
      console.error("[pipeline] extração falhou", err);
      await repo.updateInvoice(invoice.id, { status: "failed" });
      await step(`Falha na leitura da fatura: ${pipelineError}. Seguindo com dados do formulário.`);
    }
  }

  // Sem fatura: usa dados informados no simulador (se houver)
  let dataOrigin: "fatura" | "informado" = "fatura";
  if (!invoice) {
    const sim = await repo.getLatestSimulation(leadId);
    if (sim) {
      extracted = simulationToInvoiceData(sim.input);
      dataOrigin = "informado";
    }
  }

  // MOTOR DE REGRAS (determinístico)
  const audit = runAudit({
    invoice: extracted,
    dataOrigin,
    extractionConfidence,
    lead: {
      billRange: lead.billRange,
      solarStatus: lead.solarStatus,
      freeMarketStatus: lead.freeMarketStatus,
      state: lead.state,
      city: lead.city,
    },
  });
  await step(
    `Motor de regras v${audit.engineVersion}: ${audit.counts.attention} pontos de atenção, ${audit.counts.analysis} análises, ${audit.counts.opportunity} oportunidades.`,
  );

  // EXPLICAÇÃO (IA com guardas; fallback para template)
  const explanation = await explainAudit(audit, { company: lead.company });
  if (explanation.guardFailures.length) {
    await step(`Guardas de IA reprovaram ${explanation.guardFailures.length} trecho(s); usado texto padrão nesses pontos.`, {
      failures: explanation.guardFailures.slice(0, 10),
    });
  }

  await repo.saveDiagnostic({
    leadId,
    invoiceId: invoice?.id ?? null,
    audit,
    summary: explanation.summary,
    summarySource: explanation.summarySource,
    findingTexts: explanation.findingTexts,
    engineVersion: audit.engineVersion,
  });

  // SCORE + QUALIFICAÇÃO
  const s = scoreLead({
    billRange: lead.billRange,
    audit,
    completeness: validation?.completeness ?? null,
    intentSignals: lead.intentSignals,
    hasInvoice: Boolean(invoice),
  });
  let updated: LeadRecord = await repo.updateLead(leadId, {
    score: s.score,
    temperature: s.temperature,
    scoreBreakdown: s.components,
    recommendedSolutions: s.recommendedSolutions,
    opportunities: audit.findings.filter((f) => f.kind !== "info").map((f) => f.title),
    potentialValue: lead.potentialValue ?? s.potentialValue,
    potentialCommission: lead.potentialCommission ?? s.potentialCommission,
    processingStatus: invoice ? (pipelineError ? "failed" : "done") : "no_invoice",
    processingError: pipelineError,
  });
  await step(`Score ${s.score}/100 — ${s.temperature}. Pipeline em ${Math.round((Date.now() - t0) / 100) / 10}s.`);

  if (invoice && ["novo_lead", "fatura_recebida", "auditoria_processando"].includes(updated.stage)) {
    updated = await changeStage(leadId, "auditoria_concluida");
  }
  if ((s.temperature === "HOT" || s.temperature === "WARM") && ["novo_lead", "auditoria_concluida"].includes(updated.stage)) {
    updated = await changeStage(leadId, "qualificado", "sistema", `score ${s.temperature}`);
  }

  // AUTOMAÇÃO (confirmação, admin, CRM externo, follow-up)
  if (opts.silent) return;
  try {
    await runPostDiagnosisAutomation(updated, explanation.summary);
  } catch (err) {
    console.error("[pipeline] automação falhou", err);
    await step(`Falha na automação pós-diagnóstico: ${err instanceof Error ? err.message : err}`);
  }
}

interface ExtractionOutcome extends ExtractionResult {
  validation: ValidationResult;
  method: string;
  ocrProvider: string;
  text: string;
}

async function extractInvoice(invoice: InvoiceRecord, step: (c: string, m?: Record<string, unknown>) => Promise<unknown>): Promise<ExtractionOutcome> {
  const buf = await storage().read(invoice.storagePath);
  const mime = invoice.mimeType as AcceptedMime;

  // OCR / texto
  const ocr = await extractText(buf, mime);
  await step(`Leitura do documento: ${ocr.provider}${ocr.pages ? `, ${ocr.pages} página(s)` : ""}, ${ocr.text.length} caracteres.`, {
    warnings: ocr.warnings,
  });

  // Camada 1: regex determinístico
  const regex = ocr.text ? parseInvoiceText(ocr.text) : null;

  // Camada 2: IA (texto ou visão)
  let llmData: Partial<InvoiceData> | null = null;
  let llmSource: "llm" | "llm_vision" = "llm";
  const methods: string[] = [];
  if (regex) methods.push("regex");
  try {
    if (ocr.text.trim().length > 150) {
      llmData = await extractInvoiceWithLLM(ocr.text);
    } else if (mime !== "application/pdf") {
      llmSource = "llm_vision";
      llmData = await extractInvoiceWithVision(`data:${mime};base64,${buf.toString("base64")}`);
    }
    if (llmData) methods.push(llmSource);
  } catch (err) {
    await step(`IA de extração indisponível (${err instanceof Error ? err.message.slice(0, 120) : "erro"}); seguindo só com regras.`);
  }

  let merged: ExtractionResult;
  if (regex || llmData) {
    merged = mergeExtractions(regex, llmData, { sourceText: ocr.text, llmSource });
  } else {
    merged = { data: parseInvoiceText("").data, meta: {} };
  }
  merged.data = normalize(merged.data, merged.meta);

  const isBill = ocr.text ? looksLikeEnergyBill(ocr.text) : Boolean(llmData && (llmData.totalAmount || llmData.consumptionKwh));
  const { data, result } = validateInvoice(merged.data, merged.meta, { looksLikeEnergyBill: isBill });
  return { data, meta: merged.meta, validation: result, method: methods.join("+") || "nenhum", ocrProvider: ocr.provider, text: ocr.text };
}

/** Converte entradas de simulador em dados estruturados (origem: informado pelo usuário). */
function simulationToInvoiceData(input: Record<string, unknown>): InvoiceData {
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const data = parseInvoiceText("").data;
  data.totalAmount = num(input.monthlyBill);
  data.consumptionKwh = num(input.consumptionKwh) ?? num(input.monthlyConsumptionKwh);
  data.distributor = str(input.distributor);
  data.customerClass = str(input.customerClass);
  data.consumerUnit = str(input.consumerUnit);
  data.contractedDemandKw = num(input.demandKw);
  data.voltage = str(input.voltage);
  const g = str(input.tariffGroup);
  data.tariffGroup = g === "A" || g === "B" ? g : null;
  const m = str(input.tariffModality)?.toLowerCase() ?? "";
  data.tariffModality = m.includes("azul") ? "azul" : m.includes("verde") ? "verde" : m.includes("branca") ? "branca" : m.includes("conv") ? "convencional" : null;
  return normalize(data, {});
}

function averageConfidence(meta: FieldMetaMap): number | undefined {
  const values = Object.values(meta).map((m) => m?.confidence ?? 0);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : undefined;
}
