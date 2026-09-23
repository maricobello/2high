import { round } from "@/lib/utils";
import { PARAMS } from "../rules-engine/parameters";

/**
 * Análise preliminar de perfil para o Mercado Livre de Energia (ACL).
 * Nunca afirma elegibilidade: classifica o PERFIL para avaliação comercial.
 *
 * Contexto regulatório considerado (a validar sempre):
 * - Portaria MME 50/2022: desde 01/2024 consumidores do Grupo A podem migrar;
 *   abaixo de 500 kW, via comercializador varejista.
 * - Baixa tensão (Grupo B): abertura ainda dependente de regulamentação.
 */
export interface FreeMarketInput {
  distributor?: string | null;
  monthlyConsumptionKwh?: number | null;
  demandKw?: number | null;
  tariffGroup?: "A" | "B" | null;
  tariffModality?: string | null;
  voltage?: string | null;
  city?: string | null;
  state?: string | null;
  operatingHours?: "comercial" | "estendido" | "24h" | null;
  consumptionProfile?: "estavel" | "sazonal" | "variavel" | null;
  monthlyBill?: number | null;
  alreadyInFreeMarket?: boolean;
}

export type FreeMarketStatus = "perfil_compativel" | "requer_validacao" | "fora_do_perfil_atual" | "ja_no_mercado_livre";

export interface FreeMarketResult {
  status: FreeMarketStatus;
  statusLabel: string;
  profileSummary: string;
  identified: { label: string; value: string }[];
  pointsToValidate: string[];
  savingsMin: number | null;
  savingsMax: number | null;
  savingsNote: string;
  needsCommercialAnalysis: boolean;
  confidence: "alta" | "média" | "baixa";
  disclaimer: string;
}

export const FREE_MARKET_DISCLAIMER =
  "Análise preliminar de perfil. A elegibilidade e a viabilidade econômica dependem de validação técnica, regulatória e comercial (contrato vigente com a distribuidora, medição, prazos de migração e preços de energia).";

const HOURS_LABEL = { comercial: "Horário comercial", estendido: "Horário estendido", "24h": "Operação 24h" } as const;
const PROFILE_LABEL = { estavel: "Consumo estável", sazonal: "Consumo sazonal", variavel: "Consumo variável" } as const;

export function analyzeFreeMarket(input: FreeMarketInput): FreeMarketResult {
  const identified: FreeMarketResult["identified"] = [];
  const pointsToValidate: string[] = [
    "Contrato vigente com a distribuidora (prazo de aviso para denúncia do contrato de energia)",
    "Adequação do sistema de medição (SMF) às regras da CCEE",
    "Modalidade de contratação (varejista ou atacadista) e garantias financeiras",
    "Preços de energia e prazo de contrato no momento da proposta",
  ];

  let group = input.tariffGroup ?? null;
  if (!group && (input.demandKw ?? 0) > 0) group = "A";
  if (!group && input.tariffModality && /verde|azul/i.test(input.tariffModality)) group = "A";

  if (input.distributor) identified.push({ label: "Distribuidora", value: input.distributor });
  if (group) identified.push({ label: "Grupo tarifário", value: `Grupo ${group}` });
  if (input.tariffModality) identified.push({ label: "Modalidade", value: input.tariffModality });
  if (input.voltage) identified.push({ label: "Tensão", value: input.voltage });
  if (input.demandKw) identified.push({ label: "Demanda", value: `${round(input.demandKw, 0)} kW` });
  if (input.monthlyConsumptionKwh) identified.push({ label: "Consumo mensal", value: `${Math.round(input.monthlyConsumptionKwh).toLocaleString("pt-BR")} kWh` });
  if (input.operatingHours) identified.push({ label: "Funcionamento", value: HOURS_LABEL[input.operatingHours] });
  if (input.consumptionProfile) identified.push({ label: "Perfil", value: PROFILE_LABEL[input.consumptionProfile] });
  if (input.city || input.state) identified.push({ label: "Localização", value: [input.city, input.state].filter(Boolean).join(" / ") });

  let bill = input.monthlyBill ?? null;
  if (!bill && input.monthlyConsumptionKwh) bill = input.monthlyConsumptionKwh * (group === "A" ? PARAMS.groupA.fallbackAvgPrice : PARAMS.groupB.fallbackAvgPrice);

  let status: FreeMarketStatus;
  let profileSummary: string;

  if (input.alreadyInFreeMarket) {
    status = "ja_no_mercado_livre";
    profileSummary = "A empresa informou já estar no Mercado Livre. Uma revisão do contrato atual pode identificar oportunidades na renovação.";
  } else if (group === "A") {
    const large = (input.demandKw ?? 0) >= PARAMS.freeMarket.wholesaleDemandKw;
    status = bill !== null && bill < PARAMS.freeMarket.minMonthlyBill ? "requer_validacao" : "perfil_compativel";
    profileSummary = large
      ? "Unidade em média/alta tensão com demanda relevante: perfil compatível com avaliação de migração, inclusive em modalidade atacadista."
      : "Unidade em média/alta tensão (Grupo A): perfil compatível com avaliação de migração via comercializador varejista.";
    if (status === "requer_validacao") {
      profileSummary += " O volume de consumo informado é baixo; a viabilidade econômica precisa ser confirmada.";
    }
    pointsToValidate.push("Demanda contratada e histórico de 12 meses de consumo por posto horário");
  } else if (group === "B") {
    status = "fora_do_perfil_atual";
    profileSummary =
      "Unidades em baixa tensão (Grupo B) ainda dependem de regulamentação para migrar ao Mercado Livre. Enquanto isso, GD por assinatura e revisão tarifária podem ser alternativas.";
  } else {
    status = "requer_validacao";
    profileSummary = "Não foi possível identificar o grupo tarifário. Com a fatura ou a tensão de fornecimento, conseguimos classificar o perfil.";
    pointsToValidate.unshift("Grupo tarifário e tensão de fornecimento");
  }

  if (input.operatingHours === "24h" || input.consumptionProfile === "estavel") {
    identified.push({ label: "Observação", value: "Consumo contínuo tende a facilitar a contratação de energia em bloco" });
  }

  let savingsMin: number | null = null;
  let savingsMax: number | null = null;
  let savingsNote = "Potencial de economia não calculável com os dados informados.";
  if ((status === "perfil_compativel" || status === "requer_validacao") && group === "A" && bill) {
    const energyPortion = bill * PARAMS.groupA.energyShare;
    savingsMin = round(energyPortion * PARAMS.freeMarket.discountMin, 0);
    savingsMax = round(energyPortion * PARAMS.freeMarket.discountMax, 0);
    savingsNote = `Faixa de referência de ${Math.round(PARAMS.freeMarket.discountMin * 100)}% a ${Math.round(
      PARAMS.freeMarket.discountMax * 100,
    )}% sobre a parcela de energia (~${Math.round(PARAMS.groupA.energyShare * 100)}% da conta). Depende do preço de energia contratado.`;
  }

  const filled = [input.distributor, group, input.demandKw, input.monthlyConsumptionKwh, input.tariffModality, input.voltage].filter(Boolean).length;
  const confidence: FreeMarketResult["confidence"] = filled >= 5 ? "alta" : filled >= 3 ? "média" : "baixa";

  const statusLabel = {
    perfil_compativel: "Perfil compatível com avaliação",
    requer_validacao: "Requer validação",
    fora_do_perfil_atual: "Fora do perfil no cenário regulatório atual",
    ja_no_mercado_livre: "Já no Mercado Livre",
  }[status];

  return {
    status,
    statusLabel,
    profileSummary,
    identified,
    pointsToValidate,
    savingsMin,
    savingsMax,
    savingsNote,
    needsCommercialAnalysis: status !== "fora_do_perfil_atual",
    confidence,
    disclaimer: FREE_MARKET_DISCLAIMER,
  };
}
