import type { SolutionCode } from "@/modules/leads/types";
import type { FreeMarketResult } from "../simulators/free-market";
import type { GdResult } from "../simulators/gd";

export type FindingKind = "attention" | "analysis" | "opportunity" | "info";
export type Confidence = "alta" | "média" | "baixa";

export interface Finding {
  code: string;
  kind: FindingKind;
  title: string;
  /** Explicação padrão (determinística). Pode ser reescrita pela IA em linguagem simples. */
  explanation: string;
  /** Explicação em linguagem simples gerada pela IA (opcional, validada). */
  plainExplanation?: string;
  dataUsed: { label: string; value: string }[];
  confidence: Confidence;
  disclaimer: string;
  estimatedMonthlyImpact?: { min: number; max: number } | null;
  solution?: SolutionCode;
}

export interface AuditMetrics {
  totalAmount: number | null;
  totalAmountSource: "fatura" | "informado" | "faixa_informada" | null;
  consumptionKwh: number | null;
  consumptionSource: "fatura" | "informado" | "estimado" | null;
  profile: "A" | "B" | null;
  profileLabel: string;
  avgPricePerKwh: number | null;
  distributor: string | null;
  referenceMonth: string | null;
}

export interface AuditResult {
  engineVersion: string;
  metrics: AuditMetrics;
  findings: Finding[];
  counts: { attention: number; analysis: number; opportunity: number };
  solutions: SolutionCode[];
  gd: GdResult;
  freeMarket: FreeMarketResult;
  basedOnInvoice: boolean;
}

export const PRELIMINARY_DISCLAIMER = "Análise preliminar, sujeita à validação técnica.";
