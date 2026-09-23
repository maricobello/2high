/** Enums e tipos compartilhados do domínio de leads (seguros para client e server). */

export const BILL_RANGES = [
  { value: "ate_1k", label: "Até R$ 1.000", min: 0, max: 1000, midpoint: 700 },
  { value: "1k_4k", label: "R$ 1.000 – R$ 4.000", min: 1000, max: 4000, midpoint: 2500 },
  { value: "4k_10k", label: "R$ 4.000 – R$ 10.000", min: 4000, max: 10000, midpoint: 7000 },
  { value: "10k_50k", label: "R$ 10.000 – R$ 50.000", min: 10000, max: 50000, midpoint: 25000 },
  { value: "50k_mais", label: "Mais de R$ 50.000", min: 50000, max: 250000, midpoint: 80000 },
] as const;
export type BillRange = (typeof BILL_RANGES)[number]["value"];

export const SOLAR_STATUS = [
  { value: "nao", label: "Não" },
  { value: "propria", label: "Sim, própria" },
  { value: "assinatura", label: "Sim, assinatura" },
  { value: "nao_sei", label: "Não sei" },
] as const;
export type SolarStatus = (typeof SOLAR_STATUS)[number]["value"];

export const FREE_MARKET_STATUS = [
  { value: "nao", label: "Não" },
  { value: "sim", label: "Sim" },
  { value: "nao_sei", label: "Não sei" },
] as const;
export type FreeMarketStatus = (typeof FREE_MARKET_STATUS)[number]["value"];

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB",
  "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type UF = (typeof UFS)[number];

export const LEAD_SOURCES = ["hero_form", "gd_simulator", "ml_simulator", "admin", "api"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

/** Pipeline comercial (colunas do CRM), na ordem. */
export const STAGES = [
  { value: "novo_lead", label: "Novo lead" },
  { value: "fatura_recebida", label: "Fatura recebida" },
  { value: "auditoria_processando", label: "Auditoria processando" },
  { value: "auditoria_concluida", label: "Auditoria concluída" },
  { value: "qualificado", label: "Qualificado" },
  { value: "contato_realizado", label: "Contato realizado" },
  { value: "reuniao", label: "Reunião" },
  { value: "proposta", label: "Proposta" },
  { value: "negociacao", label: "Negociação" },
  { value: "fechado", label: "Fechado" },
  { value: "perdido", label: "Perdido" },
] as const;
export type Stage = (typeof STAGES)[number]["value"];
export const STAGE_VALUES = STAGES.map((s) => s.value) as [Stage, ...Stage[]];

export function stageIndex(stage: Stage): number {
  return STAGE_VALUES.indexOf(stage);
}
export function stageLabel(stage: Stage): string {
  return STAGES.find((s) => s.value === stage)?.label ?? stage;
}
/** Estágios em que o time comercial já assumiu o lead (automação de follow-up para). */
export function isHumanHandled(stage: Stage): boolean {
  return stageIndex(stage) >= stageIndex("contato_realizado");
}

export type Temperature = "HOT" | "WARM" | "COLD";

export type ProcessingStatus = "pending" | "processing" | "done" | "failed" | "no_invoice";

/** Sinais de intenção demonstrada pelo lead (entram no score). */
export const INTENT_SIGNALS = [
  "uploaded_invoice",
  "whatsapp_click",
  "requested_gd_proposal",
  "requested_ml_analysis",
  "used_gd_simulator",
  "used_ml_simulator",
  "replied_message",
  "positive_reply",
] as const;
export type IntentSignal = (typeof INTENT_SIGNALS)[number];

export type SolutionCode = "auditoria" | "gd_assinatura" | "mercado_livre" | "antecipacao";

export const SOLUTION_LABELS: Record<SolutionCode, string> = {
  auditoria: "Revisão técnica da fatura",
  gd_assinatura: "GD por assinatura",
  mercado_livre: "Mercado Livre de Energia",
  antecipacao: "Antecipação de benefício econômico",
};

export function billRangeInfo(value: BillRange | null | undefined) {
  return BILL_RANGES.find((r) => r.value === value) ?? null;
}

export function billRangeFromAmount(amount: number | null | undefined): BillRange | null {
  if (!amount) return null;
  if (amount <= 1000) return "ate_1k";
  if (amount <= 4000) return "1k_4k";
  if (amount <= 10000) return "4k_10k";
  if (amount <= 50000) return "10k_50k";
  return "50k_mais";
}
