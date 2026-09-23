import { formatBRL, formatNumber, round } from "@/lib/utils";
import { billRangeInfo, type BillRange, type FreeMarketStatus as LeadFreeMarketStatus, type SolarStatus, type SolutionCode } from "@/modules/leads/types";
import type { InvoiceData } from "@/modules/invoice/types";
import { analyzeFreeMarket } from "../simulators/free-market";
import { simulateGd } from "../simulators/gd";
import { ENGINE_VERSION, PARAMS } from "./parameters";
import { PRELIMINARY_DISCLAIMER, type AuditMetrics, type AuditResult, type Confidence, type Finding } from "./types";

/**
 * MOTOR DE AUDITORIA — 100% determinístico.
 * Recebe dados validados da fatura + contexto do lead e produz achados,
 * métricas e soluções potenciais. Nenhuma chamada de IA acontece aqui.
 */
export interface AuditInput {
  invoice: InvoiceData | null;
  /** Origem dos dados: fatura lida pelo sistema ou dados informados pelo usuário (simuladores). */
  dataOrigin?: "fatura" | "informado";
  /** Confiança média dos campos lidos (0..1) — reduz a confiança dos achados. */
  extractionConfidence?: number;
  lead: {
    billRange: BillRange | null;
    solarStatus: SolarStatus | null;
    freeMarketStatus: LeadFreeMarketStatus | null;
    state?: string | null;
    city?: string | null;
  };
  now?: Date;
}

const kwh = (v: number | null) => formatNumber(v, "kWh");
const kw = (v: number | null) => formatNumber(v, "kW");

export function runAudit(input: AuditInput): AuditResult {
  const inv = input.invoice;
  const origin = input.dataOrigin ?? "fatura";
  const lead = input.lead;
  const findings: Finding[] = [];
  const range = billRangeInfo(lead.billRange);
  const lowRead = (input.extractionConfidence ?? 0.7) < 0.55;

  const conf = (base: Confidence): Confidence => {
    if (!lowRead) return base;
    return base === "alta" ? "média" : "baixa";
  };

  // ---------- Métricas ----------
  const totalFromInvoice = inv?.totalAmount ?? null;
  const totalAmount = totalFromInvoice ?? range?.midpoint ?? null;
  const profile = inv?.tariffGroup ?? null;
  let consumption = inv?.consumptionKwh ?? null;
  let consumptionSource: AuditMetrics["consumptionSource"] = consumption !== null ? origin : null;
  if (consumption === null && totalAmount) {
    consumption = round(totalAmount / (profile === "A" ? PARAMS.groupA.fallbackAvgPrice : PARAMS.groupB.fallbackAvgPrice), 0);
    consumptionSource = "estimado";
  }
  const metrics: AuditMetrics = {
    totalAmount,
    totalAmountSource: totalFromInvoice !== null ? origin : totalAmount !== null ? "faixa_informada" : null,
    consumptionKwh: consumption,
    consumptionSource,
    profile,
    profileLabel: profile === "A" ? "Grupo A (média/alta tensão)" : profile === "B" ? "Grupo B (baixa tensão)" : "Não identificado",
    avgPricePerKwh: totalFromInvoice && inv?.consumptionKwh ? round(totalFromInvoice / inv.consumptionKwh, 3) : null,
    distributor: inv?.distributor ?? null,
    referenceMonth: inv?.referenceMonth ?? null,
  };

  if (inv) {
    // 1. ULTRAPASSAGEM DE DEMANDA
    const contracted = inv.contractedDemandKw;
    const measured = inv.measuredDemandKw;
    const overrunCharged = (inv.demandOverrunAmount ?? 0) > 0 || (inv.demandOverrunKw ?? 0) > 0;
    if (contracted && measured && measured > contracted * (1 + PARAMS.demand.overrunTolerance)) {
      const excess = measured - contracted;
      findings.push({
        code: "demand_overrun",
        kind: "attention",
        title: "Possível ultrapassagem de demanda",
        explanation: `A demanda medida (${kw(measured)}) ficou acima da demanda contratada (${kw(contracted)}) além da tolerância de ${Math.round(
          PARAMS.demand.overrunTolerance * 100,
        )}%. Quando isso acontece, a distribuidora pode cobrar a parcela excedente com tarifa de ultrapassagem, que é mais cara. Vale revisar se a demanda contratada está adequada à operação.`,
        dataUsed: [
          { label: "Demanda contratada", value: kw(contracted) },
          { label: "Demanda medida", value: kw(measured) },
          { label: "Excedente", value: kw(round(excess, 1)) },
          ...(inv.demandOverrunAmount ? [{ label: "Valor de ultrapassagem na fatura", value: formatBRL(inv.demandOverrunAmount) }] : []),
        ],
        confidence: conf(overrunCharged ? "alta" : "média"),
        disclaimer: PRELIMINARY_DISCLAIMER,
        estimatedMonthlyImpact: inv.demandOverrunAmount ? { min: 0, max: round(inv.demandOverrunAmount, 0) } : null,
        solution: "auditoria",
      });
    } else if (overrunCharged) {
      findings.push({
        code: "demand_overrun_charge",
        kind: "attention",
        title: "Possível ultrapassagem de demanda",
        explanation:
          "A fatura apresenta lançamento relacionado a ultrapassagem de demanda. Esse tipo de cobrança costuma indicar que a demanda contratada está abaixo do pico real da operação.",
        dataUsed: [
          ...(inv.demandOverrunKw ? [{ label: "Ultrapassagem", value: kw(inv.demandOverrunKw) }] : []),
          ...(inv.demandOverrunAmount ? [{ label: "Valor lançado", value: formatBRL(inv.demandOverrunAmount) }] : []),
        ],
        confidence: conf("média"),
        disclaimer: PRELIMINARY_DISCLAIMER,
        estimatedMonthlyImpact: inv.demandOverrunAmount ? { min: 0, max: round(inv.demandOverrunAmount, 0) } : null,
        solution: "auditoria",
      });
    }

    // 2. DEMANDA CONTRATADA (possível sobrecontratação)
    const peakMeasured = measured ?? null;
    if (contracted && peakMeasured !== null && peakMeasured < contracted * PARAMS.demand.underuseThreshold) {
      findings.push({
        code: "demand_underuse",
        kind: "analysis",
        title: "Revisão da demanda contratada",
        explanation: `A demanda medida (${kw(peakMeasured)}) representa cerca de ${Math.round(
          (peakMeasured / contracted) * 100,
        )}% da demanda contratada (${kw(contracted)}). Isso pode indicar descompasso entre o contrato e o perfil de uso. A confirmação exige o histórico de 12 meses, pois a operação pode ter sazonalidade.`,
        dataUsed: [
          { label: "Demanda contratada", value: kw(contracted) },
          { label: "Demanda medida", value: kw(peakMeasured) },
        ],
        confidence: conf(inv.history.length >= 6 ? "média" : "baixa"),
        disclaimer: PRELIMINARY_DISCLAIMER,
        solution: "auditoria",
      });
    }

    // 3. ENERGIA REATIVA / FATOR DE POTÊNCIA
    const pf = inv.powerFactor;
    const reactiveCharged = (inv.reactiveAmount ?? 0) > 0 || (inv.reactiveEnergyKvarh ?? 0) > 0;
    if ((pf !== null && pf < PARAMS.powerFactor.reference) || reactiveCharged) {
      findings.push({
        code: "reactive_energy",
        kind: "attention",
        title: "Cobrança ou indicador de energia reativa",
        explanation: `${
          pf !== null && pf < PARAMS.powerFactor.reference
            ? `O fator de potência identificado (${pf.toFixed(2)}) está abaixo da referência regulatória de ${PARAMS.powerFactor.reference}. `
            : ""
        }${reactiveCharged ? "A fatura apresenta lançamento de energia reativa excedente. " : ""}Em geral, isso pode ser tratado com correção do fator de potência (por exemplo, banco de capacitores), após avaliação técnica no local.`,
        dataUsed: [
          ...(pf !== null ? [{ label: "Fator de potência", value: pf.toFixed(2) }] : []),
          ...(inv.reactiveEnergyKvarh ? [{ label: "Energia reativa excedente", value: formatNumber(inv.reactiveEnergyKvarh, "kvarh") }] : []),
          ...(inv.reactiveAmount ? [{ label: "Valor lançado", value: formatBRL(inv.reactiveAmount) }] : []),
        ],
        confidence: conf(reactiveCharged ? "alta" : "média"),
        disclaimer: PRELIMINARY_DISCLAIMER,
        estimatedMonthlyImpact: inv.reactiveAmount ? { min: 0, max: round(inv.reactiveAmount, 0) } : null,
        solution: "auditoria",
      });
    }

    // 4. ESTRUTURA TARIFÁRIA
    if (profile === "A" && inv.tariffModality) {
      const peakShare =
        inv.consumptionPeakKwh !== null && inv.consumptionKwh ? inv.consumptionPeakKwh / inv.consumptionKwh : null;
      findings.push({
        code: "tariff_structure",
        kind: "analysis",
        title: "Revisão da estrutura tarifária",
        explanation: `A unidade está na modalidade ${inv.tariffModality === "azul" ? "horária Azul" : inv.tariffModality === "verde" ? "horária Verde" : inv.tariffModality}. ${
          peakShare !== null ? `O consumo na ponta representa ${Math.round(peakShare * 100)}% do total. ` : ""
        }A comparação entre modalidades (Verde x Azul) com base no histórico de 12 meses pode indicar a opção mais adequada ao perfil de uso.`,
        dataUsed: [
          { label: "Modalidade", value: inv.tariffModality },
          ...(inv.tariffSubgroup ? [{ label: "Subgrupo", value: inv.tariffSubgroup }] : []),
          ...(inv.consumptionPeakKwh !== null ? [{ label: "Consumo ponta", value: kwh(inv.consumptionPeakKwh) }] : []),
          ...(inv.consumptionOffPeakKwh !== null ? [{ label: "Consumo fora ponta", value: kwh(inv.consumptionOffPeakKwh) }] : []),
        ],
        confidence: conf("média"),
        disclaimer: PRELIMINARY_DISCLAIMER,
        solution: "auditoria",
      });
    } else if (profile === "B" && (totalAmount ?? 0) >= PARAMS.groupB.tariffReviewMinBill) {
      findings.push({
        code: "tariff_structure_b",
        kind: "analysis",
        title: "Revisão da estrutura tarifária",
        explanation:
          "A unidade está em baixa tensão com gasto elevado. Pode ser interessante avaliar alternativas de enquadramento tarifário (como tarifa branca ou, em alguns casos, adequação para média tensão) e soluções de energia compartilhada.",
        dataUsed: [
          { label: "Grupo tarifário", value: "B" },
          { label: "Valor da fatura", value: formatBRL(totalAmount) },
        ],
        confidence: conf("baixa"),
        disclaimer: PRELIMINARY_DISCLAIMER,
        solution: "auditoria",
      });
    }

    // 5. VARIAÇÕES ANORMAIS
    if (inv.history.length >= PARAMS.anomaly.minHistoryPoints) {
      const values = inv.history.map((h) => h.kwh);
      const current = inv.consumptionKwh ?? values[values.length - 1];
      const previous = inv.consumptionKwh !== null ? values : values.slice(0, -1);
      const mean = previous.reduce((a, b) => a + b, 0) / previous.length;
      const deviation = mean > 0 ? (current - mean) / mean : 0;
      if (Math.abs(deviation) >= PARAMS.anomaly.relativeDeviation) {
        findings.push({
          code: "consumption_anomaly",
          kind: "attention",
          title: deviation > 0 ? "Consumo acima da média histórica" : "Consumo abaixo da média histórica",
          explanation: `O consumo do período (${kwh(current)}) está ${Math.round(Math.abs(deviation) * 100)}% ${
            deviation > 0 ? "acima" : "abaixo"
          } da média dos meses anteriores (${kwh(round(mean, 0))}). Variações assim podem ter causa operacional, mas também podem indicar erro de leitura ou de faturamento — vale confirmar.`,
          dataUsed: [
            { label: "Consumo do período", value: kwh(current) },
            { label: "Média histórica", value: kwh(round(mean, 0)) },
            { label: "Meses analisados", value: String(previous.length) },
          ],
          confidence: conf("média"),
          disclaimer: PRELIMINARY_DISCLAIMER,
          solution: "auditoria",
        });
      }
    }

    // 6. CRÉDITOS / COMPENSAÇÃO
    if ((inv.compensatedEnergyKwh ?? 0) > 0 || (inv.injectedEnergyKwh ?? 0) > 0 || (inv.creditBalanceKwh ?? 0) > 0) {
      const balance = inv.creditBalanceKwh ?? 0;
      const monthly = inv.consumptionKwh ?? 0;
      const accumulating = monthly > 0 && balance > monthly * 3;
      findings.push({
        code: "compensation",
        kind: accumulating ? "analysis" : "info",
        title: accumulating ? "Saldo de créditos elevado" : "Compensação de energia identificada",
        explanation: accumulating
          ? `O saldo de créditos (${kwh(balance)}) equivale a mais de 3 meses de consumo. Créditos acumulados têm prazo de validade; pode valer revisar o rateio ou o dimensionamento.`
          : "A fatura apresenta informações de compensação de energia (geração distribuída). Conferimos os valores identificados; a validação completa exige o demonstrativo de compensação.",
        dataUsed: [
          ...(inv.injectedEnergyKwh ? [{ label: "Energia injetada", value: kwh(inv.injectedEnergyKwh) }] : []),
          ...(inv.compensatedEnergyKwh ? [{ label: "Energia compensada", value: kwh(inv.compensatedEnergyKwh) }] : []),
          ...(inv.creditBalanceKwh ? [{ label: "Saldo de créditos", value: kwh(inv.creditBalanceKwh) }] : []),
        ],
        confidence: conf("média"),
        disclaimer: PRELIMINARY_DISCLAIMER,
        solution: "gd_assinatura",
      });
    }

    // Bandeira tarifária (informativo)
    if (inv.tariffFlag && inv.tariffFlag !== "verde") {
      findings.push({
        code: "tariff_flag",
        kind: "info",
        title: "Bandeira tarifária com acréscimo",
        explanation:
          "O período foi faturado com bandeira tarifária que acrescenta custo à energia. Isso não é erro de faturamento, mas aumenta o valor da conta e reforça o interesse em alternativas de suprimento.",
        dataUsed: [{ label: "Bandeira", value: inv.tariffFlag.replace("_", " ") }],
        confidence: conf("alta"),
        disclaimer: PRELIMINARY_DISCLAIMER,
      });
    }
  }

  // 7. GERAÇÃO DISTRIBUÍDA
  const gd = simulateGd({
    monthlyBill: totalAmount,
    consumptionKwh: inv?.consumptionKwh ?? null,
    distributor: inv?.distributor ?? null,
    state: lead.state,
    city: lead.city,
    customerClass: inv?.customerClass,
    tariffGroup: profile,
    publicLightingAmount: inv?.publicLightingAmount,
    solarStatus: lead.solarStatus,
    year: (input.now ?? new Date()).getFullYear(),
  });
  if (gd.fit === "compativel" || gd.fit === "avaliar") {
    findings.push({
      code: "gd_opportunity",
      kind: "opportunity",
      title: gd.fit === "compativel" ? "Perfil compatível com avaliação de GD por assinatura" : "GD por assinatura: avaliação recomendada",
      explanation: `${gd.reasons.join(" ")} Com base nos dados disponíveis, o potencial estimado é de ${formatBRL(gd.savingsMin, { cents: false })} a ${formatBRL(
        gd.savingsMax,
        { cents: false },
      )} por mês.`,
      dataUsed: [
        { label: "Valor considerado", value: formatBRL(gd.monthlyBill) },
        { label: "Consumo considerado", value: kwh(gd.consumptionKwh) },
        { label: "Parcela compensável estimada", value: formatBRL(gd.compensableAmount) },
      ],
      confidence: gd.confidence === "alta" && !lowRead ? "média" : "baixa",
      disclaimer: gd.disclaimer,
      estimatedMonthlyImpact: gd.savingsMin !== null && gd.savingsMax !== null ? { min: gd.savingsMin, max: gd.savingsMax } : null,
      solution: "gd_assinatura",
    });
  }

  // 8. MERCADO LIVRE
  const fm = analyzeFreeMarket({
    distributor: inv?.distributor ?? null,
    monthlyConsumptionKwh: inv?.consumptionKwh ?? consumption,
    demandKw: inv?.contractedDemandKw ?? inv?.measuredDemandKw ?? null,
    tariffGroup: profile,
    tariffModality: inv?.tariffModality ?? null,
    voltage: inv?.voltage ?? null,
    city: lead.city,
    state: lead.state,
    monthlyBill: totalAmount,
    alreadyInFreeMarket: lead.freeMarketStatus === "sim",
  });
  if (fm.status === "perfil_compativel" || (fm.status === "requer_validacao" && profile === "A")) {
    findings.push({
      code: "free_market_opportunity",
      kind: "opportunity",
      title: "Perfil para avaliação de Mercado Livre",
      explanation: `${fm.profileSummary}${
        fm.savingsMin !== null ? ` Potencial estimado de ${formatBRL(fm.savingsMin, { cents: false })} a ${formatBRL(fm.savingsMax, { cents: false })} por mês.` : ""
      }`,
      dataUsed: fm.identified.slice(0, 5),
      confidence: fm.confidence === "alta" && !lowRead ? "média" : "baixa",
      disclaimer: fm.disclaimer,
      estimatedMonthlyImpact: fm.savingsMin !== null && fm.savingsMax !== null ? { min: fm.savingsMin, max: fm.savingsMax } : null,
      solution: "mercado_livre",
    });
  } else if (!profile && (totalAmount ?? 0) >= PARAMS.freeMarket.minMonthlyBill) {
    findings.push({
      code: "free_market_check",
      kind: "analysis",
      title: "Verificar enquadramento para Mercado Livre",
      explanation:
        "Pelo valor da conta, vale verificar se a unidade está em média tensão (Grupo A). Se estiver, o perfil pode ser avaliado para migração ao Mercado Livre.",
      dataUsed: [{ label: "Valor considerado", value: formatBRL(totalAmount) }],
      confidence: "baixa",
      disclaimer: fm.disclaimer,
      solution: "mercado_livre",
    });
  }

  const counts = {
    attention: findings.filter((f) => f.kind === "attention").length,
    analysis: findings.filter((f) => f.kind === "analysis").length,
    opportunity: findings.filter((f) => f.kind === "opportunity").length,
  };

  const solutions: SolutionCode[] = [];
  if (findings.some((f) => f.solution === "mercado_livre" && f.kind === "opportunity")) solutions.push("mercado_livre");
  if (findings.some((f) => f.solution === "gd_assinatura" && f.kind === "opportunity")) solutions.push("gd_assinatura");
  if (findings.some((f) => f.solution === "auditoria" && (f.kind === "attention" || f.kind === "analysis"))) solutions.push("auditoria");

  const order = { attention: 0, analysis: 1, opportunity: 2, info: 3 } as const;
  findings.sort((a, b) => order[a.kind] - order[b.kind]);

  return {
    engineVersion: ENGINE_VERSION,
    metrics,
    findings,
    counts,
    solutions,
    gd,
    freeMarket: fm,
    basedOnInvoice: origin === "fatura" && Boolean(inv && (inv.totalAmount !== null || inv.consumptionKwh !== null)),
  };
}
