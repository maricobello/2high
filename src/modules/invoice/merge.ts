import { normalizeDistributorName } from "./distributors";
import { textContainsNumber } from "./numbers";
import {
  NUMERIC_FIELDS,
  STRING_FIELDS,
  emptyInvoiceData,
  type ExtractionResult,
  type FieldMetaMap,
  type InvoiceData,
} from "./types";

/**
 * Combina a extração determinística (regex) com a extração por IA.
 *
 * Regras (determinísticas):
 * - Campo só num lado → usa o que existe.
 * - Ambos iguais (tolerância 1%) → confiança alta ("regex+llm").
 * - Divergência → mantém o valor da IA apenas se o número aparece literalmente
 *   no texto do documento; caso contrário mantém o regex.
 * - Números da IA que NÃO aparecem no texto são descartados (anti-alucinação),
 *   exceto quando a extração foi feita por visão (sem texto para conferir).
 */
export function mergeExtractions(
  regex: ExtractionResult | null,
  llm: Partial<InvoiceData> | null,
  opts: { sourceText: string; llmSource: "llm" | "llm_vision" },
): ExtractionResult {
  const base = regex?.data ?? emptyInvoiceData();
  const data: InvoiceData = { ...base, history: [...base.history] };
  const meta: FieldMetaMap = { ...(regex?.meta ?? {}) };
  const canVerify = opts.sourceText.trim().length > 100;

  if (!llm) return { data, meta };

  for (const field of NUMERIC_FIELDS) {
    const lv = toNumber(llm[field]);
    if (lv === null) continue;
    const rv = data[field];
    const verified = canVerify ? textContainsNumber(opts.sourceText, lv) : false;

    if (rv === null) {
      if (canVerify && !verified) {
        continue; // número não encontrado no documento: descartado
      }
      data[field] = lv;
      meta[field] = {
        source: opts.llmSource,
        confidence: verified ? 0.75 : 0.55,
        note: verified ? undefined : "Extraído por leitura visual; não foi possível conferir com texto do documento.",
      };
      continue;
    }

    if (approxEqual(rv, lv)) {
      meta[field] = { source: "regex+llm", confidence: 0.92 };
    } else if (verified) {
      data[field] = lv;
      meta[field] = { source: opts.llmSource, confidence: 0.6, note: `Divergência com leitura automática (${rv}).` };
    } else {
      meta[field] = { ...(meta[field] ?? { source: "regex" }), confidence: 0.5, note: `IA sugeriu ${lv}, não confirmado no documento.` };
    }
  }

  for (const field of STRING_FIELDS) {
    const raw = llm[field];
    if (raw === null || raw === undefined || raw === "") continue;
    const lv = String(raw).trim();
    const current = data[field];
    if (current === null) {
      (data as unknown as Record<string, unknown>)[field] = lv;
      meta[field] = { source: opts.llmSource, confidence: 0.65 };
    } else if (String(current).toLowerCase() === lv.toLowerCase()) {
      meta[field] = { source: "regex+llm", confidence: 0.9 };
    }
  }

  if (!data.history.length && Array.isArray(llm.history)) {
    const hist = llm.history
      .map((h) => ({ month: String(h?.month ?? ""), kwh: toNumber(h?.kwh) }))
      .filter((h): h is { month: string; kwh: number } => /^\d{4}-\d{2}$/.test(h.month) && h.kwh !== null && h.kwh > 0);
    if (hist.length >= 3) {
      data.history = hist.sort((a, b) => a.month.localeCompare(b.month)).slice(-13);
      meta.history = { source: opts.llmSource, confidence: 0.55 };
    }
  }

  return { data: normalize(data, meta), meta };
}

/** Normalizações determinísticas pós-fusão. */
export function normalize(data: InvoiceData, meta: FieldMetaMap): InvoiceData {
  const out = { ...data };
  out.distributor = normalizeDistributorName(out.distributor);

  if (out.tariffGroup) {
    const g = String(out.tariffGroup).toUpperCase().replace(/[^AB]/g, "").slice(0, 1);
    out.tariffGroup = g === "A" || g === "B" ? g : null;
  }
  if (out.tariffSubgroup && !out.tariffGroup) {
    const g = out.tariffSubgroup.trim().toUpperCase()[0];
    if (g === "A" || g === "B") {
      out.tariffGroup = g;
      meta.tariffGroup = { source: "derived", confidence: 0.8 };
    }
  }
  if (out.tariffModality) {
    const m = String(out.tariffModality).toLowerCase();
    out.tariffModality = m.includes("azul") ? "azul" : m.includes("verde") ? "verde" : m.includes("branca") ? "branca" : m.includes("conv") ? "convencional" : null;
  }
  if (!out.tariffGroup && (out.tariffModality === "verde" || out.tariffModality === "azul")) {
    out.tariffGroup = "A";
    meta.tariffGroup = { source: "derived", confidence: 0.75 };
  }
  if (out.tariffFlag) {
    const f = String(out.tariffFlag).toLowerCase();
    out.tariffFlag = f.includes("verde")
      ? "verde"
      : f.includes("amarela")
        ? "amarela"
        : f.includes("escassez")
          ? "escassez_hidrica"
          : f.includes("2") || f.includes("ii")
            ? "vermelha_2"
            : f.includes("vermelha")
              ? "vermelha_1"
              : null;
  }
  if (out.powerFactor !== null && out.powerFactor > 1 && out.powerFactor <= 100) {
    out.powerFactor = out.powerFactor / 100;
    meta.powerFactor = { ...(meta.powerFactor ?? { source: "derived" }), confidence: 0.5, note: "Convertido de percentual." };
  }
  if (out.consumptionKwh === null && out.consumptionPeakKwh !== null && out.consumptionOffPeakKwh !== null) {
    out.consumptionKwh = out.consumptionPeakKwh + out.consumptionOffPeakKwh;
    meta.consumptionKwh = { source: "derived", confidence: 0.8, note: "Soma de ponta e fora ponta." };
  }
  return out;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const cleaned = v.replace(/[^\d.,-]/g, "");
    const n = cleaned.includes(",") ? Number(cleaned.replace(/\./g, "").replace(",", ".")) : Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function approxEqual(a: number, b: number): boolean {
  if (a === b) return true;
  const denom = Math.max(Math.abs(a), Math.abs(b), 1e-9);
  return Math.abs(a - b) / denom <= 0.01;
}
