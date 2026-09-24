import { BILL_RANGES, type BillRange } from "@/modules/leads/types";
import { simulateGd } from "@/modules/simulators/gd";

/**
 * Quiz do hero: 5 perguntas de um toque → diagnóstico preliminar.
 * Tudo aqui é determinístico e mostra apenas grandezas verificáveis
 * (volume pago no período revisável e ICMS embutido), nunca um valor
 * "a recuperar" inventado.
 */
export type Segment = "industria" | "comercio" | "servicos" | "agro" | "saude_educacao" | "condominio";
export type AuditHistory = "nunca" | "mais_2_anos" | "recente";
export type Tenure = "menos_1" | "1_5" | "mais_5";
export type Voltage = "a" | "b" | "nao_sei";

export interface QuizAnswers {
  bill: BillRange;
  segment: Segment;
  audited: AuditHistory;
  tenure: Tenure;
  voltage: Voltage;
}

export const QUESTIONS = [
  {
    key: "bill",
    title: "Quanto sua empresa paga de energia por mês?",
    options: BILL_RANGES.map((r) => ({ value: r.value, label: r.label })),
  },
  {
    key: "segment",
    title: "Qual é o segmento da empresa?",
    options: [
      { value: "industria", label: "Indústria" },
      { value: "comercio", label: "Comércio e varejo" },
      { value: "servicos", label: "Serviços e escritórios" },
      { value: "agro", label: "Agronegócio" },
      { value: "saude_educacao", label: "Saúde, educação ou hotelaria" },
      { value: "condominio", label: "Condomínio ou shopping" },
    ],
  },
  {
    key: "audited",
    title: "Alguém já auditou as contas de energia da empresa?",
    options: [
      { value: "nunca", label: "Nunca" },
      { value: "mais_2_anos", label: "Sim, há mais de 2 anos" },
      { value: "recente", label: "Sim, nos últimos 2 anos" },
    ],
  },
  {
    key: "tenure",
    title: "Há quanto tempo a empresa está nesse endereço?",
    options: [
      { value: "menos_1", label: "Menos de 1 ano" },
      { value: "1_5", label: "De 1 a 5 anos" },
      { value: "mais_5", label: "Mais de 5 anos" },
    ],
  },
  {
    key: "voltage",
    title: "A unidade é de média ou alta tensão (Grupo A)?",
    hint: "Grupo A costuma ter “demanda contratada” na fatura.",
    options: [
      { value: "a", label: "Sim, Grupo A" },
      { value: "b", label: "Não, baixa tensão (Grupo B)" },
      { value: "nao_sei", label: "Não sei" },
    ],
  },
] as const;

export type QuestionKey = (typeof QUESTIONS)[number]["key"];

/** Alíquota de referência conservadora (as alíquotas estaduais de energia ficam em torno de 17% a 23%). */
export const ICMS_REFERENCE_RATE = 0.17;

export interface Front {
  code: "cobrancas" | "demanda_reativo" | "icms_demanda" | "icms_credito" | "gd" | "mercado_livre";
  title: string;
  detail: string;
}

export interface Diagnosis {
  level: "ALTO" | "MÉDIO" | "MODERADO";
  score: number;
  months: number;
  monthlyBill: number;
  auditableVolume: number;
  icmsEmbedded: number | null;
  gdSavings: { min: number; max: number } | null;
  fronts: Front[];
}

const MONTHS: Record<Tenure, number> = { menos_1: 12, "1_5": 36, mais_5: 60 };

export function diagnose(a: QuizAnswers): Diagnosis {
  const range = BILL_RANGES.find((r) => r.value === a.bill) ?? BILL_RANGES[0];
  const monthlyBill = range.midpoint;
  const months = MONTHS[a.tenure];
  const auditableVolume = monthlyBill * months;

  let score = 40;
  score += a.audited === "nunca" ? 30 : a.audited === "mais_2_anos" ? 15 : 0;
  score += a.voltage === "a" ? 15 : a.voltage === "nao_sei" ? 10 : 0;
  score += months === 60 ? 10 : months === 36 ? 5 : 0;
  score += a.segment === "industria" ? 5 : 0;
  score = Math.min(95, score);
  const level = score >= 70 ? "ALTO" : score >= 55 ? "MÉDIO" : "MODERADO";

  const fronts: Front[] = [
    {
      code: "cobrancas",
      title: "Cobranças indevidas na fatura",
      detail: `Erros de leitura, tarifa ou classe em até ${months} faturas. Valor pago a mais pode voltar em dobro (CDC, art. 42).`,
    },
  ];
  if (a.voltage !== "b") {
    fronts.push({
      code: "demanda_reativo",
      title: "Demanda contratada e energia reativa",
      detail: "Ultrapassagens, contrato acima do uso e multas de reativo estão entre os custos mais comuns no Grupo A.",
    });
    fronts.push({
      code: "icms_demanda",
      title: "ICMS sobre demanda não utilizada",
      detail: "O ICMS só incide sobre a demanda efetivamente utilizada (Súmula 391 do STJ).",
    });
  }
  const industrial = a.segment === "industria";
  if (industrial) {
    fronts.push({
      code: "icms_credito",
      title: "Crédito de ICMS da energia usada na produção",
      detail: "Indústrias podem se creditar do ICMS da energia consumida no processo produtivo, com laudo técnico (LC 87/96, art. 33).",
    });
  }
  let gdSavings: Diagnosis["gdSavings"] = null;
  if (a.voltage === "b" || a.voltage === "nao_sei") {
    const gd = simulateGd({ monthlyBill, tariffGroup: null });
    if (gd.savingsMin !== null && gd.savingsMax !== null) {
      gdSavings = { min: gd.savingsMin, max: gd.savingsMax };
      fronts.push({ code: "gd", title: "Energia por assinatura", detail: "Desconto na conta daqui para frente, sem obra e sem trocar de distribuidora." });
    }
  }
  if (a.voltage === "a" && monthlyBill >= 10_000) {
    fronts.push({ code: "mercado_livre", title: "Mercado Livre de energia", detail: "Unidades do Grupo A podem comprar energia com preço negociado." });
  }

  return {
    level,
    score,
    months,
    monthlyBill,
    auditableVolume,
    icmsEmbedded: industrial ? Math.round(auditableVolume * ICMS_REFERENCE_RATE) : null,
    gdSavings,
    fronts,
  };
}

/** Resumo legível das respostas (vai para as notas do lead no CRM). */
export function quizSummary(a: Partial<QuizAnswers>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const v = a[q.key as QuestionKey];
    const opt = q.options.find((o) => o.value === v);
    if (opt) out[q.key] = opt.label;
  }
  return out;
}
