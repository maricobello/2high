import { round } from "@/lib/utils";
import { PARAMS, fioBNonCompensatedFor } from "../rules-engine/parameters";

/**
 * Estimativa preliminar de GD por assinatura (geração compartilhada).
 * Cálculo 100% determinístico, com faixa (nunca percentual fixo).
 */
export interface GdInput {
  monthlyBill: number | null;
  consumptionKwh?: number | null;
  distributor?: string | null;
  state?: string | null;
  city?: string | null;
  customerClass?: string | null;
  tariffGroup?: "A" | "B" | null;
  consumerUnit?: string | null;
  publicLightingAmount?: number | null;
  solarStatus?: "nao" | "propria" | "assinatura" | "nao_sei" | null;
  /** Ano de referência para a regra de transição do Fio B. */
  year?: number;
}

export type GdFit = "compativel" | "avaliar" | "baixo_potencial" | "dados_insuficientes";

export interface GdResult {
  fit: GdFit;
  fitLabel: string;
  monthlyBill: number | null;
  consumptionKwh: number | null;
  compensableAmount: number | null;
  savingsMin: number | null;
  savingsMax: number | null;
  annualMin: number | null;
  annualMax: number | null;
  reasons: string[];
  assumptions: string[];
  pointsToValidate: string[];
  confidence: "alta" | "média" | "baixa";
  disclaimer: string;
}

export const GD_DISCLAIMER =
  "Estimativa preliminar. A economia final depende das condições da unidade consumidora, modalidade de compensação, disponibilidade do projeto e condições comerciais.";

export function simulateGd(input: GdInput): GdResult {
  const year = input.year ?? new Date().getFullYear();
  const group = input.tariffGroup ?? null;
  const reasons: string[] = [];
  const assumptions: string[] = [];
  const pointsToValidate = [
    "Titularidade e dados da unidade consumidora",
    "Disponibilidade de projeto de geração compartilhada na área da distribuidora",
    "Modalidade de compensação e regras de rateio de créditos",
    "Condições comerciais (desconto, prazo e reajuste)",
  ];

  let bill = input.monthlyBill && input.monthlyBill > 0 ? input.monthlyBill : null;
  let kwh = input.consumptionKwh && input.consumptionKwh > 0 ? input.consumptionKwh : null;
  const avgPrice = group === "A" ? PARAMS.groupA.fallbackAvgPrice : PARAMS.groupB.fallbackAvgPrice;

  if (!bill && kwh) {
    bill = kwh * avgPrice;
    assumptions.push(`Valor da conta estimado a partir do consumo (R$ ${avgPrice.toFixed(2)}/kWh de referência).`);
  }
  if (bill && !kwh) {
    kwh = bill / avgPrice;
    assumptions.push(`Consumo estimado a partir do valor da conta (R$ ${avgPrice.toFixed(2)}/kWh de referência).`);
  }

  if (!bill || !kwh) {
    return {
      fit: "dados_insuficientes",
      fitLabel: "Dados insuficientes",
      monthlyBill: bill,
      consumptionKwh: kwh,
      compensableAmount: null,
      savingsMin: null,
      savingsMax: null,
      annualMin: null,
      annualMax: null,
      reasons: ["Informe o valor médio da conta ou o consumo médio para estimar."],
      assumptions,
      pointsToValidate,
      confidence: "baixa",
      disclaimer: GD_DISCLAIMER,
    };
  }

  const avgPricePerKwh = bill / kwh;
  let compensable: number;

  if (group === "A") {
    compensable = bill * PARAMS.groupA.energyShare;
    assumptions.push(`Grupo A: considerada apenas a parcela de energia (~${Math.round(PARAMS.groupA.energyShare * 100)}% da conta); demanda não é compensada.`);
  } else {
    const cip = input.publicLightingAmount ?? bill * PARAMS.groupB.publicLightingShare;
    const availabilityCost = Math.min(PARAMS.groupB.availabilityKwh, kwh) * avgPricePerKwh;
    const energyAmount = Math.max(bill - cip - availabilityCost, 0);
    const fioBLoss = PARAMS.gd.fioBShare * fioBNonCompensatedFor(year);
    compensable = energyAmount * (1 - fioBLoss);
    assumptions.push(
      `Excluídos custo de disponibilidade (${PARAMS.groupB.availabilityKwh} kWh) e iluminação pública.`,
      `Lei 14.300/2022: em ${year}, ~${Math.round(fioBNonCompensatedFor(year) * 100)}% do Fio B não é compensado para novas adesões.`,
    );
  }
  assumptions.push(
    `Faixa de desconto comercial de referência: ${Math.round(PARAMS.gd.discountMin * 100)}% a ${Math.round(PARAMS.gd.discountMax * 100)}% sobre a energia compensável.`,
  );

  const savingsMin = round(compensable * PARAMS.gd.discountMin, 0);
  const savingsMax = round(compensable * PARAMS.gd.discountMax, 0);

  let fit: GdFit;
  if (input.solarStatus === "propria") {
    fit = "baixo_potencial";
    reasons.push("A empresa informou possuir geração própria; o potencial adicional depende do saldo não coberto.");
  } else if (bill < PARAMS.gd.minMonthlyBill || kwh < PARAMS.gd.minMonthlyKwh) {
    fit = "baixo_potencial";
    reasons.push("Conta/consumo abaixo do patamar em que projetos de GD por assinatura costumam atender.");
  } else if (input.solarStatus === "assinatura") {
    fit = "avaliar";
    reasons.push("A empresa já utiliza assinatura; pode valer comparar condições comerciais atuais.");
  } else if (group === "A") {
    fit = "avaliar";
    reasons.push("Unidades do Grupo A podem aderir, mas o benefício se limita à parcela de energia; comparar com Mercado Livre.");
  } else {
    fit = "compativel";
    reasons.push("Perfil de consumo compatível com avaliação de GD por assinatura.");
  }
  if (!input.distributor) {
    reasons.push("Distribuidora não identificada: a disponibilidade de projetos precisa ser confirmada.");
  }

  const confidence: GdResult["confidence"] =
    input.monthlyBill && input.consumptionKwh && input.distributor ? "alta" : input.monthlyBill || input.consumptionKwh ? "média" : "baixa";

  const fitLabel = {
    compativel: "Perfil compatível com avaliação",
    avaliar: "Avaliação recomendada",
    baixo_potencial: "Potencial reduzido",
    dados_insuficientes: "Dados insuficientes",
  }[fit];

  return {
    fit,
    fitLabel,
    monthlyBill: round(bill, 2),
    consumptionKwh: round(kwh, 0),
    compensableAmount: round(compensable, 2),
    savingsMin,
    savingsMax,
    annualMin: savingsMin * 12,
    annualMax: savingsMax * 12,
    reasons,
    assumptions,
    pointsToValidate,
    confidence,
    disclaimer: GD_DISCLAIMER,
  };
}
