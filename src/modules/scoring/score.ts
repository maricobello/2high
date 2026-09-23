import { billRangeInfo, type BillRange, type IntentSignal, type SolutionCode, type Temperature } from "@/modules/leads/types";
import type { AuditResult } from "@/modules/rules-engine/types";
import { PARAMS } from "@/modules/rules-engine/parameters";
import { round } from "@/lib/utils";

/**
 * Lead scoring determinístico (0–100). Cada componente tem peso máximo
 * explícito para que o time comercial entenda e ajuste a régua.
 */
export interface ScoreInput {
  billRange: BillRange | null;
  audit: AuditResult | null;
  completeness: number | null;
  intentSignals: IntentSignal[];
  hasInvoice: boolean;
}

export interface ScoreComponent {
  key: string;
  label: string;
  points: number;
  max: number;
  detail?: string;
}

export interface ScoreResult {
  score: number;
  temperature: Temperature;
  components: ScoreComponent[];
  potentialValue: number | null;
  potentialCommission: number | null;
  recommendedSolutions: SolutionCode[];
}

export const TEMPERATURE_THRESHOLDS = { HOT: 65, WARM: 40 } as const;

export function temperatureFor(score: number): Temperature {
  if (score >= TEMPERATURE_THRESHOLDS.HOT) return "HOT";
  if (score >= TEMPERATURE_THRESHOLDS.WARM) return "WARM";
  return "COLD";
}

function billPoints(amount: number | null): number {
  if (!amount) return 0;
  if (amount >= 50_000) return 25;
  if (amount >= 10_000) return 21;
  if (amount >= 4_000) return 15;
  if (amount >= 1_000) return 9;
  return 3;
}

function consumptionPoints(kwh: number | null): number {
  if (!kwh) return 0;
  if (kwh >= 50_000) return 10;
  if (kwh >= 10_000) return 8;
  if (kwh >= 3_000) return 6;
  if (kwh >= 1_000) return 4;
  return 1;
}

export function scoreLead(input: ScoreInput): ScoreResult {
  const audit = input.audit;
  const m = audit?.metrics;
  const amount = m?.totalAmount ?? billRangeInfo(input.billRange)?.midpoint ?? null;
  const components: ScoreComponent[] = [];
  const push = (key: string, label: string, points: number, max: number, detail?: string) =>
    components.push({ key, label, points: Math.min(max, Math.max(0, Math.round(points))), max, detail });

  push("bill", "Valor da conta", billPoints(amount), 25, amount ? `R$ ${Math.round(amount).toLocaleString("pt-BR")}` : undefined);
  push("consumption", "Consumo", consumptionPoints(m?.consumptionKwh ?? null), 10);
  push("group_a", "Grupo A", m?.profile === "A" ? 10 : 0, 10);

  const inv = audit?.basedOnInvoice;
  const demandFinding = audit?.findings.some((f) => f.code.startsWith("demand"));
  push("demand", "Demanda", demandFinding ? 5 : m?.profile === "A" ? 3 : 0, 5);

  const gd = audit?.gd;
  const gdPts = gd ? (gd.fit === "compativel" ? 10 : gd.fit === "avaliar" ? 6 : 0) : 0;
  push("gd", "Potencial de GD", gdPts, 10, gd?.fitLabel);

  const fm = audit?.freeMarket;
  const fmPts = fm ? (fm.status === "perfil_compativel" ? 10 : fm.status === "requer_validacao" ? 4 : fm.status === "ja_no_mercado_livre" ? 3 : 0) : 0;
  push("free_market", "Perfil Mercado Livre", fmPts, 10, fm?.statusLabel);

  const issues = audit ? audit.counts.attention * 4 + audit.counts.analysis * 2 : 0;
  push("issues", "Pontos encontrados na fatura", issues, 10);

  push("completeness", "Completude dos dados", (input.completeness ?? (inv ? 0.5 : 0.15)) * 10, 10);

  const s = new Set(input.intentSignals);
  const intent =
    (input.hasInvoice || s.has("uploaded_invoice") ? 4 : 0) +
    (s.has("whatsapp_click") ? 3 : 0) +
    (s.has("requested_gd_proposal") ? 3 : 0) +
    (s.has("requested_ml_analysis") ? 3 : 0) +
    (s.has("used_gd_simulator") || s.has("used_ml_simulator") ? 1 : 0) +
    (s.has("replied_message") ? 2 : 0) +
    (s.has("positive_reply") ? 3 : 0);
  push("intent", "Intenção demonstrada", intent, 10);

  const score = Math.min(100, components.reduce((acc, c) => acc + c.points, 0));

  const recommended = audit?.solutions.length ? audit.solutions : ([] as SolutionCode[]);
  const annualSpend = amount ? amount * 12 : null;
  const mainSolution = recommended[0];
  const rate = mainSolution && mainSolution !== "antecipacao" ? PARAMS.commission[mainSolution] : null;

  return {
    score,
    temperature: temperatureFor(score),
    components,
    potentialValue: annualSpend ? round(annualSpend, 0) : null,
    potentialCommission: annualSpend && rate ? round(annualSpend * rate, 0) : null,
    recommendedSolutions: recommended,
  };
}
