/**
 * MÓDULO 4 — ANTECIPAÇÃO DE BENEFÍCIO ECONÔMICO (previsto, desativado no MVP).
 *
 * Ideia: transformar a economia projetada de um contrato (GD / Mercado Livre)
 * em recurso antecipado para o cliente, financiado por investidores.
 * Tabelas correspondentes já existem na migração 0001 (sem uso no MVP).
 */
export interface Opportunity {
  id: string;
  leadId: string;
  solution: "auditoria" | "gd_assinatura" | "mercado_livre" | "antecipacao";
  status: "aberta" | "em_analise" | "proposta" | "ganha" | "perdida";
  estimatedMonthlyMin: number | null;
  estimatedMonthlyMax: number | null;
  partnerId: string | null;
}

export interface Contract {
  id: string;
  opportunityId: string;
  partnerId: string | null;
  kind: string;
  startDate: string | null;
  endDate: string | null;
  monthlyValue: number | null;
  status: "rascunho" | "assinado" | "ativo" | "encerrado" | "cancelado";
}

export interface ProjectedSavings {
  id: string;
  contractId: string;
  referenceMonth: string;
  projectedAmount: number;
  realizedAmount: number | null;
  method: "engine" | "manual";
  engineVersion: string | null;
}

export interface Investor {
  id: string;
  name: string;
  kind: "fundo" | "fidc" | "pessoa_juridica" | "pessoa_fisica" | "outro";
  capacityAmount: number | null;
  active: boolean;
}

export interface AdvanceOffer {
  id: string;
  contractId: string;
  investorId: string | null;
  grossAmount: number;
  discountRate: number;
  netAmount: number;
  monthsCovered: number;
  status: "simulada" | "ofertada" | "aceita" | "liquidada" | "recusada" | "expirada";
}

export interface Partner {
  id: string;
  name: string;
  kind: "comercializadora" | "gd" | "consultoria" | "representante" | "outro";
  commissionRate: number | null;
}

export interface Payment {
  id: string;
  direction: "in" | "out";
  amount: number;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
}

export interface Commission {
  id: string;
  partnerId: string | null;
  leadId: string | null;
  contractId: string | null;
  amount: number;
  status: "prevista" | "aprovada" | "paga" | "cancelada";
}
