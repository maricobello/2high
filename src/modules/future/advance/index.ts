import "server-only";
import { env } from "@/lib/env";
import type { AdvanceOffer, ProjectedSavings } from "./types";

export type * from "./types";

/** O módulo só pode ser exposto quando a flag estiver ligada. */
export function isAdvanceEnabled(): boolean {
  return env.features.advance;
}

/**
 * Cálculo determinístico (esqueleto) do valor presente da economia projetada.
 * Mantido aqui para fixar o contrato da API; não é chamado no MVP.
 */
export function presentValueOfSavings(
  savings: Pick<ProjectedSavings, "projectedAmount">[],
  monthlyDiscountRate: number,
): Pick<AdvanceOffer, "grossAmount" | "netAmount" | "monthsCovered" | "discountRate"> {
  if (!isAdvanceEnabled()) throw new Error("Módulo de antecipação desativado.");
  const gross = savings.reduce((a, s) => a + s.projectedAmount, 0);
  const net = savings.reduce((a, s, i) => a + s.projectedAmount / (1 + monthlyDiscountRate) ** (i + 1), 0);
  return { grossAmount: Math.round(gross * 100) / 100, netAmount: Math.round(net * 100) / 100, monthsCovered: savings.length, discountRate: monthlyDiscountRate };
}
