import { detectDistributor } from "./distributors";
import { normalizeText, parseBrNumber } from "./numbers";
import {
  emptyInvoiceData,
  type ExtractionResult,
  type FieldMetaMap,
  type HistoryPoint,
  type InvoiceData,
  type TariffFlag,
  type TariffModality,
} from "./types";

/**
 * Parser determinístico (regex) para faturas brasileiras.
 * É a primeira camada de extração: rápido, auditável e sem custo.
 * A camada de IA complementa campos que o regex não encontrar.
 */

const NUM = "(\\d{1,3}(?:\\.\\d{3})+(?:,\\d+)?|\\d+(?:,\\d+)?|\\d+\\.\\d+)";
const MONEY = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2})";
const GAP = "[^\\d\\n]{0,45}";

const REGEX_CONFIDENCE = 0.6;

function firstNumber(text: string, patterns: RegExp[]): number | null {
  for (const p of patterns) {
    const m = p.exec(text);
    if (m) {
      const raw = m[m.length - 1];
      const n = parseBrNumber(raw);
      if (n !== null) return n;
    }
  }
  return null;
}

function rx(source: string, flags = "i"): RegExp {
  return new RegExp(source, flags);
}

const MONTHS: Record<string, string> = {
  JAN: "01", FEV: "02", MAR: "03", ABR: "04", MAI: "05", JUN: "06",
  JUL: "07", AGO: "08", SET: "09", OUT: "10", NOV: "11", DEZ: "12",
};

function toIsoMonth(monthToken: string, yearToken: string): string | null {
  const m = MONTHS[monthToken.slice(0, 3).toUpperCase()];
  if (!m) return null;
  let y = Number(yearToken);
  if (!Number.isFinite(y)) return null;
  if (y < 100) y += 2000;
  if (y < 2000 || y > 2100) return null;
  return `${y}-${m}`;
}

function brDateToIso(d: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function parseHistory(text: string): HistoryPoint[] {
  const re = /\b(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*[\s/.-]{0,2}(\d{2}|\d{4})\b[^\d\n]{0,12}(\d{1,3}(?:\.\d{3})+|\d{1,7})(?:,\d+)?/gi;
  const points = new Map<string, number>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const month = toIsoMonth(m[1], m[2]);
    const kwh = parseBrNumber(m[3]);
    if (!month || kwh === null || kwh <= 0 || kwh > 50_000_000) continue;
    if (!points.has(month)) points.set(month, kwh);
  }
  const list = [...points.entries()].map(([month, kwh]) => ({ month, kwh })).sort((a, b) => a.month.localeCompare(b.month));
  return list.length >= 3 ? list.slice(-13) : [];
}

function parseFlag(text: string): TariffFlag | null {
  const m = /bandeira\s*(?:tarif[aá]ria\s*)?(?:vigente\s*)?:?\s*(verde|amarela|vermelha(?:\s*[-–]?\s*(?:patamar\s*)?(1|2|i{1,2}))?|escassez\s+h[ií]drica)/i.exec(text);
  if (!m) return null;
  const word = m[1].toLowerCase();
  if (word.startsWith("verde")) return "verde";
  if (word.startsWith("amarela")) return "amarela";
  if (word.startsWith("escassez")) return "escassez_hidrica";
  const level = (m[2] || "1").toLowerCase();
  return level === "2" || level === "ii" ? "vermelha_2" : "vermelha_1";
}

function parseModality(text: string): TariffModality | null {
  if (/(horo[\s-]?sazonal|modalidade|tarifa|ths|mod\.?\s*tarif[aá]ria)[^\n]{0,30}\bazul\b/i.test(text) || /\bazul\s+a[1-4]/i.test(text)) return "azul";
  if (/(horo[\s-]?sazonal|modalidade|tarifa|ths|mod\.?\s*tarif[aá]ria)[^\n]{0,30}\bverde\b/i.test(text) || /\bverde\s+a[1-4]/i.test(text)) return "verde";
  if (/tarifa\s+branca/i.test(text)) return "branca";
  if (/convencional/i.test(text)) return "convencional";
  return null;
}

function parseClass(text: string): string | null {
  const m = /\b(comercial|industrial|residencial|rural|poder\s+p[uú]blico|servi[cç]o\s+p[uú]blico|ilumina[cç][aã]o\s+p[uú]blica)\b/i.exec(
    (/classe[^\n]{0,60}/i.exec(text)?.[0] ?? "") + "\n" + text,
  );
  if (!m) return null;
  const v = m[1].toLowerCase();
  if (v.startsWith("comercial")) return "Comercial";
  if (v.startsWith("industrial")) return "Industrial";
  if (v.startsWith("residencial")) return "Residencial";
  if (v.startsWith("rural")) return "Rural";
  if (v.startsWith("poder")) return "Poder Público";
  if (v.startsWith("servi")) return "Serviço Público";
  return "Iluminação Pública";
}

function parseSubgroup(text: string): { group: "A" | "B" | null; subgroup: string | null } {
  const sub = /\b(?:sub\s*grupo|subgrupo|grupo\s*\/\s*subgrupo|classifica[cç][aã]o)?[:\s]*\b(A1|A2|A3a|A3|A4|AS|B1|B2|B3|B4[ab]?)\b/.exec(text);
  const grp = /grupo\s+(?:tarif[aá]rio\s+)?:?\s*([AB])\b/i.exec(text);
  const subgroup = sub ? sub[1] : null;
  let group: "A" | "B" | null = subgroup ? (subgroup[0] as "A" | "B") : null;
  if (!group && grp) group = grp[1].toUpperCase() as "A" | "B";
  return { group, subgroup };
}

export function parseInvoiceText(rawText: string): ExtractionResult {
  const text = normalizeText(rawText);
  const data: InvoiceData = emptyInvoiceData();

  const dist = detectDistributor(text);
  data.distributor = dist?.name ?? null;

  const uc = /(?:unidade\s+consumidora|n[ºo°.]?\s*(?:da\s+)?instala[cç][aã]o|c[oó]digo\s+(?:da\s+)?instala[cç][aã]o|c[oó]digo\s+(?:do\s+)?cliente|n[ºo°.]?\s*(?:do\s+)?cliente|\bUC\b)\s*[:.]?\s*([\d][\d\-./ ]{4,20}\d)/i.exec(text);
  data.consumerUnit = uc ? uc[1].replace(/\s/g, "") : null;

  data.customerClass = parseClass(text);
  const { group, subgroup } = parseSubgroup(text);
  data.tariffGroup = group;
  data.tariffSubgroup = subgroup;
  data.tariffModality = parseModality(text);
  const volt = /tens[aã]o(?:\s+(?:de\s+)?(?:fornecimento|nominal|contratada))?[^\d\n]{0,20}(\d{1,3}(?:[.,]\d+)?)\s*(kV|V)\b/i.exec(text);
  data.voltage = volt ? `${volt[1]} ${volt[2]}` : null;

  data.consumptionOffPeakKwh = firstNumber(text, [
    rx(`(?:consumo|energia\\s+ativa)?\\s*(?:hfp|fora\\s*(?:de\\s*)?ponta|f\\.?\\s*ponta)${GAP}${NUM}\\s*kwh`),
    rx(`(?:consumo|energia\\s+ativa)\\s*(?:hfp|fora\\s*(?:de\\s*)?ponta)${GAP}${NUM}`),
  ]);
  data.consumptionPeakKwh = firstNumber(text, [
    rx(`(?:consumo|energia\\s+ativa)\\s*(?:hp\\b|(?<!fora\\s)(?<!fora\\sde\\s)ponta)${GAP}${NUM}\\s*kwh`),
    rx(`(?<!fora\\s)(?<!fora\\sde\\s)(?<!f\\.\\s?)\\bponta\\b${GAP}${NUM}\\s*kwh`),
  ]);
  data.consumptionKwh = firstNumber(text, [
    rx(`consumo\\s+(?:total\\s+)?(?:faturado|medido|ativo|do\\s+m[eê]s|kwh)${GAP}${NUM}\\s*(?:kwh)?`),
    rx(`energia\\s+(?:ativa\\s+)?(?:el[eé]trica\\s+)?(?:consumida|fornecida)${GAP}${NUM}\\s*kwh`),
    rx(`consumo${GAP}${NUM}\\s*kwh`),
  ]);
  if (data.consumptionKwh === null && data.consumptionPeakKwh !== null && data.consumptionOffPeakKwh !== null) {
    data.consumptionKwh = data.consumptionPeakKwh + data.consumptionOffPeakKwh;
  }

  data.contractedDemandKw = firstNumber(text, [rx(`demanda\\s+contratada(?:\\s*(?:fora\\s*ponta|[uú]nica|hfp))?${GAP}${NUM}`)]);
  data.measuredDemandKw = firstNumber(text, [rx(`demanda\\s+(?:medida|registrada|lida|m[aá]xima)(?:\\s*(?:fora\\s*ponta|hfp))?${GAP}${NUM}`)]);
  data.billedDemandKw = firstNumber(text, [rx(`demanda\\s+faturada(?:\\s*(?:fora\\s*ponta|hfp))?${GAP}${NUM}`)]);

  const overrunLine = /[^\n]*ultrapassagem[^\n]*/i.exec(text)?.[0] ?? null;
  if (overrunLine) {
    data.demandOverrunKw = firstNumber(overrunLine, [rx(`ultrapassagem[^\\d\\n]{0,30}${NUM}\\s*kw\\b`)]);
    data.demandOverrunAmount = firstNumber(overrunLine, [rx(`R\\$\\s*${MONEY}`), rx(`${MONEY}\\s*$`)]);
  }

  const reactiveLine = /[^\n]*(?:energia\s+reativa|\bUFER\b|\bERE\b|reativo\s+excedente|\bDMCR\b)[^\n]*/i.exec(text)?.[0] ?? null;
  if (reactiveLine) {
    data.reactiveEnergyKvarh = firstNumber(reactiveLine, [rx(`${NUM}\\s*kvarh`)]);
    data.reactiveAmount = firstNumber(reactiveLine, [rx(`R\\$\\s*${MONEY}`), rx(`${MONEY}\\s*$`)]);
  }
  const pf = /fator\s+de\s+pot[eê]ncia[^\d\n]{0,25}(0[,.]\d{2,4}|1[,.]0{1,4})/i.exec(text);
  data.powerFactor = pf ? parseBrNumber(pf[1].replace(".", ",")) : null;

  data.tariffTeKwh = firstNumber(text, [rx(`\\bTE\\b[^\\d\\n]{0,30}(0,\\d{3,8})`)]);
  data.tariffTusdKwh = firstNumber(text, [rx(`\\bTUSD\\b[^\\d\\n]{0,30}(0,\\d{3,8})`)]);

  data.icmsAmount = firstNumber(text, [rx(`\\bICMS\\b[^\\n]{0,60}?R\\$\\s*${MONEY}`), rx(`valor\\s+(?:do\\s+)?ICMS[^\\d\\n]{0,20}${MONEY}`)]);
  data.pisCofinsAmount = firstNumber(text, [rx(`PIS\\s*\\/?\\s*COFINS[^\\n]{0,40}?R\\$\\s*${MONEY}`)]);
  data.publicLightingAmount = firstNumber(text, [
    rx(`(?:\\bCIP\\b|\\bCOSIP\\b|contrib(?:ui[cç][aã]o)?\\.?\\s+(?:de\\s+)?ilum(?:ina[cç][aã]o)?\\.?\\s+p[uú]b(?:lica)?)[^\\d\\n]{0,40}${MONEY}`),
  ]);

  data.tariffFlag = parseFlag(text);

  data.injectedEnergyKwh = firstNumber(text, [rx(`energia\\s+injetada${GAP}${NUM}`)]);
  data.compensatedEnergyKwh = firstNumber(text, [
    rx(`(?:energia\\s+compensada|cr[eé]dito\\s+(?:de\\s+energia\\s+)?utilizado|energia\\s+(?:ativa\\s+)?compensada)${GAP}${NUM}`),
  ]);
  data.creditBalanceKwh = firstNumber(text, [rx(`saldo\\s+(?:de\\s+)?(?:cr[eé]ditos?|energia)(?:\\s+(?:atual|acumulado|a\\s+utilizar))?${GAP}${NUM}\\s*kwh`)]);

  data.totalAmount = firstNumber(text, [
    rx(`(?:total\\s+a\\s+pagar|valor\\s+a\\s+pagar|valor\\s+total\\s+(?:a\\s+pagar|da\\s+fatura|da\\s+nota)?|total\\s+da\\s+(?:fatura|conta|nota))[^\\d\\n]{0,30}${MONEY}`),
    rx(`(?:total\\s+geral|valor\\s+cobrado)[^\\d\\n]{0,30}${MONEY}`),
  ]);

  const ref = /(?:m[eê]s\s+(?:de\s+)?refer[eê]ncia|refer[eê]ncia|conta\s+(?:do\s+)?m[eê]s|m[eê]s\/ano)\s*:?\s*(?:(JAN|FEV|MAR|ABR|MAI|JUN|JUL|AGO|SET|OUT|NOV|DEZ)[A-Z]*[\s/.-]{0,2}(\d{2,4})|(\d{2})\/(\d{4}))/i.exec(text);
  if (ref) {
    data.referenceMonth = ref[1] ? toIsoMonth(ref[1], ref[2]) : `${ref[4]}-${ref[3]}`;
  }
  const due = /vencimento\s*:?\s*(\d{2}\/\d{2}\/\d{4})/i.exec(text);
  data.dueDate = due ? brDateToIso(due[1]) : null;
  const period = /(\d{2}\/\d{2}\/\d{4})\s*(?:a|at[eé]|-|–)\s*(\d{2}\/\d{2}\/\d{4})/i.exec(text);
  if (period) {
    data.billingPeriodStart = brDateToIso(period[1]);
    data.billingPeriodEnd = brDateToIso(period[2]);
  }

  data.history = parseHistory(text);

  // Inferências estruturais simples
  if (!data.tariffGroup && (data.tariffModality === "verde" || data.tariffModality === "azul" || data.contractedDemandKw !== null)) {
    data.tariffGroup = "A";
  }

  const meta: FieldMetaMap = {};
  for (const [key, value] of Object.entries(data) as [keyof InvoiceData, unknown][]) {
    if (key === "history") {
      if (data.history.length) meta.history = { source: "regex", confidence: 0.5 };
      continue;
    }
    if (value !== null) meta[key] = { source: "regex", confidence: REGEX_CONFIDENCE };
  }
  return { data, meta };
}

/** Heurística: o texto parece ser de uma fatura de energia elétrica? */
export function looksLikeEnergyBill(text: string): boolean {
  const t = text.toLowerCase();
  const signals = [/kwh/, /distribui/, /consumo/, /tarif/, /energia/, /unidade consumidora|instala[cç][aã]o/, /bandeira/, /icms/, /tusd|\bte\b/];
  return signals.filter((s) => s.test(t)).length >= 3;
}
