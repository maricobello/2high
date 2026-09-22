import type { FieldMetaMap, InvoiceData, ValidationIssue, ValidationResult } from "./types";

/**
 * Validação determinística dos dados extraídos.
 * Campos implausíveis são anulados (não entram no motor de regras) e viram "issues".
 */
export function validateInvoice(
  input: InvoiceData,
  meta: FieldMetaMap,
  opts: { looksLikeEnergyBill: boolean },
): { data: InvoiceData; result: ValidationResult } {
  const data: InvoiceData = { ...input, history: [...input.history] };
  const issues: ValidationIssue[] = [];

  const range = (field: keyof InvoiceData, min: number, max: number, label: string) => {
    const v = data[field];
    if (typeof v === "number" && (v < min || v > max)) {
      issues.push({ field, severity: "warning", message: `${label} fora da faixa plausível (${v}); desconsiderado.` });
      (data as unknown as Record<string, unknown>)[field] = null;
      delete meta[field];
    }
  };

  range("totalAmount", 5, 50_000_000, "Valor total");
  range("consumptionKwh", 1, 100_000_000, "Consumo");
  range("consumptionPeakKwh", 0, 50_000_000, "Consumo ponta");
  range("consumptionOffPeakKwh", 0, 100_000_000, "Consumo fora ponta");
  range("contractedDemandKw", 1, 500_000, "Demanda contratada");
  range("measuredDemandKw", 0, 500_000, "Demanda medida");
  range("billedDemandKw", 0, 500_000, "Demanda faturada");
  range("powerFactor", 0.3, 1, "Fator de potência");
  range("tariffTeKwh", 0.05, 3, "Tarifa TE");
  range("tariffTusdKwh", 0.01, 3, "Tarifa TUSD");

  if (data.consumptionKwh !== null && data.consumptionPeakKwh !== null && data.consumptionOffPeakKwh !== null) {
    const sum = data.consumptionPeakKwh + data.consumptionOffPeakKwh;
    if (Math.abs(sum - data.consumptionKwh) / Math.max(data.consumptionKwh, 1) > 0.1) {
      issues.push({
        field: "consumptionKwh",
        severity: "warning",
        message: `Soma ponta + fora ponta (${sum}) difere do consumo total (${data.consumptionKwh}).`,
      });
    }
  }

  if (data.totalAmount !== null && data.consumptionKwh !== null && data.consumptionKwh > 0) {
    const avg = data.totalAmount / data.consumptionKwh;
    const hasCompensation = (data.compensatedEnergyKwh ?? 0) > 0 || (data.injectedEnergyKwh ?? 0) > 0;
    if (!hasCompensation && (avg < 0.25 || avg > 4)) {
      issues.push({
        field: "totalAmount",
        severity: "warning",
        message: `Preço médio implícito (R$ ${avg.toFixed(2)}/kWh) atípico; valores podem ter sido lidos incorretamente.`,
      });
    }
  }

  if (data.tariffGroup === "B" && (data.contractedDemandKw !== null || data.tariffModality === "verde" || data.tariffModality === "azul")) {
    issues.push({ field: "tariffGroup", severity: "warning", message: "Indícios de Grupo A (demanda/modalidade horária) em fatura classificada como Grupo B." });
  }

  if (!opts.looksLikeEnergyBill) {
    issues.push({ field: "document", severity: "warning", message: "O documento pode não ser uma fatura de energia elétrica." });
  }

  const completeness = computeCompleteness(data);
  const usable = data.totalAmount !== null || data.consumptionKwh !== null;
  if (!usable) {
    issues.push({ field: "document", severity: "error", message: "Não foi possível identificar valor total nem consumo." });
  }

  for (const [field, m] of Object.entries(meta)) {
    if (m && m.confidence < 0.55) {
      issues.push({ field: field as keyof InvoiceData, severity: "info", message: m.note ?? "Campo com baixa confiança de leitura." });
    }
  }

  return { data, result: { issues, completeness, usable, looksLikeEnergyBill: opts.looksLikeEnergyBill } };
}

const WEIGHTS: Partial<Record<keyof InvoiceData, number>> = {
  totalAmount: 3,
  consumptionKwh: 3,
  distributor: 2,
  tariffGroup: 2,
  customerClass: 1,
  consumerUnit: 1,
  tariffModality: 1,
  referenceMonth: 1,
  history: 2,
  contractedDemandKw: 1,
  measuredDemandKw: 1,
  powerFactor: 1,
  tariffFlag: 0.5,
  icmsAmount: 0.5,
};

export function computeCompleteness(data: InvoiceData): number {
  let total = 0;
  let got = 0;
  const isA = data.tariffGroup === "A";
  for (const [field, weight] of Object.entries(WEIGHTS) as [keyof InvoiceData, number][]) {
    // Campos de demanda/fator de potência só contam para Grupo A
    if (!isA && (field === "contractedDemandKw" || field === "measuredDemandKw" || field === "powerFactor" || field === "tariffModality")) continue;
    total += weight;
    const v = data[field];
    if (field === "history" ? data.history.length >= 3 : v !== null && v !== undefined) got += weight;
  }
  return total ? Math.round((got / total) * 100) / 100 : 0;
}
