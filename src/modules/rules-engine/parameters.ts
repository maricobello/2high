/**
 * Premissas técnicas, regulatórias e comerciais usadas pelos cálculos determinísticos.
 *
 * TODAS as estimativas financeiras da plataforma saem daqui + dados da fatura.
 * A IA nunca define esses valores. Calibre com a equipe técnica/comercial
 * e versione alterações (ENGINE_VERSION) para rastrear diagnósticos antigos.
 */
export const ENGINE_VERSION = "2026.09-1";

export const PARAMS = {
  demand: {
    /** Tolerância regulatória de ultrapassagem (REN ANEEL 1.000/2021): 5% sobre a contratada. */
    overrunTolerance: 0.05,
    /** Abaixo deste uso da demanda contratada, sinalizar possível sobrecontratação. */
    underuseThreshold: 0.7,
  },
  powerFactor: {
    /** Fator de potência de referência regulatório. */
    reference: 0.92,
  },
  anomaly: {
    /** Variação relativa vs. média do histórico que dispara ponto de atenção. */
    relativeDeviation: 0.3,
    minHistoryPoints: 4,
  },
  groupB: {
    /** Custo de disponibilidade (kWh) — usa trifásico por padrão para empresas. */
    availabilityKwh: 100,
    /** Tarifa média de referência (R$/kWh com impostos) quando não há dado da fatura. */
    fallbackAvgPrice: 1.0,
    /** Estimativa de CIP como fração da conta quando ausente. */
    publicLightingShare: 0.03,
    /** Consumo/conta a partir dos quais faz sentido olhar Grupo A/tarifa branca etc. */
    tariffReviewMinBill: 4000,
  },
  groupA: {
    /** Participação típica da parcela de energia (TE+TUSD energia) na conta do Grupo A. */
    energyShare: 0.6,
    fallbackAvgPrice: 0.75,
  },
  gd: {
    /** Conta mínima em que GD por assinatura costuma ser ofertada. */
    minMonthlyBill: 300,
    minMonthlyKwh: 300,
    /** Faixa de desconto comercial praticada sobre a energia compensada. */
    discountMin: 0.08,
    discountMax: 0.18,
    /** Participação aproximada do Fio B na tarifa de energia do Grupo B. */
    fioBShare: 0.28,
    /**
     * Lei 14.300/2022 — parcela do Fio B NÃO compensada para novos entrantes,
     * por ano (transição). Após 2028, depende de regulamentação da ANEEL.
     */
    fioBNonCompensated: { 2023: 0.15, 2024: 0.3, 2025: 0.45, 2026: 0.6, 2027: 0.75, 2028: 0.9 } as Record<number, number>,
  },
  freeMarket: {
    /** Faixa de redução sobre a parcela de energia no ACL (conservadora). */
    discountMin: 0.1,
    discountMax: 0.25,
    /** Referência de demanda para consumidor que pode atuar sem varejista. */
    wholesaleDemandKw: 500,
    /** Conta mínima em que a migração costuma ser economicamente analisável. */
    minMonthlyBill: 8000,
  },
  commission: {
    /** Taxas de comissão potencial sobre o gasto anual estimado (para priorização). */
    gd_assinatura: 0.04,
    mercado_livre: 0.03,
    auditoria: 0.02,
  },
} as const;

export function fioBNonCompensatedFor(year: number): number {
  const table = PARAMS.gd.fioBNonCompensated;
  if (table[year] !== undefined) return table[year];
  const years = Object.keys(table).map(Number).sort();
  if (year < years[0]) return 0;
  return table[years[years.length - 1]];
}
