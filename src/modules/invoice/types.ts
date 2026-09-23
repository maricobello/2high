/** Modelo canônico dos dados extraídos de uma fatura de energia. */

export type TariffGroup = "A" | "B";
export type TariffModality = "convencional" | "branca" | "verde" | "azul";
export type TariffFlag = "verde" | "amarela" | "vermelha_1" | "vermelha_2" | "escassez_hidrica";

export interface HistoryPoint {
  /** AAAA-MM */
  month: string;
  kwh: number;
}

export interface InvoiceData {
  distributor: string | null;
  consumerUnit: string | null;
  customerClass: string | null;
  tariffGroup: TariffGroup | null;
  tariffSubgroup: string | null;
  tariffModality: TariffModality | null;
  voltage: string | null;

  consumptionKwh: number | null;
  consumptionPeakKwh: number | null;
  consumptionOffPeakKwh: number | null;

  contractedDemandKw: number | null;
  measuredDemandKw: number | null;
  billedDemandKw: number | null;
  demandOverrunKw: number | null;
  demandOverrunAmount: number | null;

  reactiveEnergyKvarh: number | null;
  reactiveAmount: number | null;
  powerFactor: number | null;

  tariffTeKwh: number | null;
  tariffTusdKwh: number | null;

  icmsAmount: number | null;
  pisCofinsAmount: number | null;
  publicLightingAmount: number | null;

  tariffFlag: TariffFlag | null;

  injectedEnergyKwh: number | null;
  compensatedEnergyKwh: number | null;
  creditBalanceKwh: number | null;

  history: HistoryPoint[];

  totalAmount: number | null;
  referenceMonth: string | null;
  billingPeriodStart: string | null;
  billingPeriodEnd: string | null;
  dueDate: string | null;
}

export type InvoiceField = Exclude<keyof InvoiceData, "history"> | "history";

export type FieldSource = "regex" | "llm" | "llm_vision" | "regex+llm" | "derived" | "user";

export interface FieldMeta {
  source: FieldSource;
  /** 0..1 */
  confidence: number;
  note?: string;
}

export type FieldMetaMap = Partial<Record<InvoiceField, FieldMeta>>;

export interface ExtractionResult {
  data: InvoiceData;
  meta: FieldMetaMap;
}

export type IssueSeverity = "info" | "warning" | "error";

export interface ValidationIssue {
  field: InvoiceField | "document";
  severity: IssueSeverity;
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  /** 0..1 — completude ponderada dos campos-chave */
  completeness: number;
  /** Há dados mínimos para auditoria baseada em fatura? */
  usable: boolean;
  looksLikeEnergyBill: boolean;
}

export function emptyInvoiceData(): InvoiceData {
  return {
    distributor: null,
    consumerUnit: null,
    customerClass: null,
    tariffGroup: null,
    tariffSubgroup: null,
    tariffModality: null,
    voltage: null,
    consumptionKwh: null,
    consumptionPeakKwh: null,
    consumptionOffPeakKwh: null,
    contractedDemandKw: null,
    measuredDemandKw: null,
    billedDemandKw: null,
    demandOverrunKw: null,
    demandOverrunAmount: null,
    reactiveEnergyKvarh: null,
    reactiveAmount: null,
    powerFactor: null,
    tariffTeKwh: null,
    tariffTusdKwh: null,
    icmsAmount: null,
    pisCofinsAmount: null,
    publicLightingAmount: null,
    tariffFlag: null,
    injectedEnergyKwh: null,
    compensatedEnergyKwh: null,
    creditBalanceKwh: null,
    history: [],
    totalAmount: null,
    referenceMonth: null,
    billingPeriodStart: null,
    billingPeriodEnd: null,
    dueDate: null,
  };
}

export const FIELD_LABELS: Record<InvoiceField, string> = {
  distributor: "Distribuidora",
  consumerUnit: "Unidade consumidora",
  customerClass: "Classe",
  tariffGroup: "Grupo tarifário",
  tariffSubgroup: "Subgrupo",
  tariffModality: "Modalidade tarifária",
  voltage: "Tensão de fornecimento",
  consumptionKwh: "Consumo total (kWh)",
  consumptionPeakKwh: "Consumo ponta (kWh)",
  consumptionOffPeakKwh: "Consumo fora ponta (kWh)",
  contractedDemandKw: "Demanda contratada (kW)",
  measuredDemandKw: "Demanda medida (kW)",
  billedDemandKw: "Demanda faturada (kW)",
  demandOverrunKw: "Ultrapassagem de demanda (kW)",
  demandOverrunAmount: "Valor de ultrapassagem (R$)",
  reactiveEnergyKvarh: "Energia reativa excedente (kvarh)",
  reactiveAmount: "Valor de energia reativa (R$)",
  powerFactor: "Fator de potência",
  tariffTeKwh: "Tarifa TE (R$/kWh)",
  tariffTusdKwh: "Tarifa TUSD (R$/kWh)",
  icmsAmount: "ICMS (R$)",
  pisCofinsAmount: "PIS/COFINS (R$)",
  publicLightingAmount: "Contribuição de iluminação pública (R$)",
  tariffFlag: "Bandeira tarifária",
  injectedEnergyKwh: "Energia injetada (kWh)",
  compensatedEnergyKwh: "Energia compensada (kWh)",
  creditBalanceKwh: "Saldo de créditos (kWh)",
  history: "Histórico de consumo",
  totalAmount: "Valor total (R$)",
  referenceMonth: "Mês de referência",
  billingPeriodStart: "Início do período",
  billingPeriodEnd: "Fim do período",
  dueDate: "Vencimento",
};

export const NUMERIC_FIELDS = [
  "consumptionKwh",
  "consumptionPeakKwh",
  "consumptionOffPeakKwh",
  "contractedDemandKw",
  "measuredDemandKw",
  "billedDemandKw",
  "demandOverrunKw",
  "demandOverrunAmount",
  "reactiveEnergyKvarh",
  "reactiveAmount",
  "powerFactor",
  "tariffTeKwh",
  "tariffTusdKwh",
  "icmsAmount",
  "pisCofinsAmount",
  "publicLightingAmount",
  "injectedEnergyKwh",
  "compensatedEnergyKwh",
  "creditBalanceKwh",
  "totalAmount",
] as const satisfies readonly (keyof InvoiceData)[];
export type NumericField = (typeof NUMERIC_FIELDS)[number];

export const STRING_FIELDS = [
  "distributor",
  "consumerUnit",
  "customerClass",
  "tariffGroup",
  "tariffSubgroup",
  "tariffModality",
  "voltage",
  "tariffFlag",
  "referenceMonth",
  "billingPeriodStart",
  "billingPeriodEnd",
  "dueDate",
] as const satisfies readonly (keyof InvoiceData)[];
export type StringField = (typeof STRING_FIELDS)[number];
