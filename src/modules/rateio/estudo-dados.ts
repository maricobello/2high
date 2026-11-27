/**
 * Conteúdo do estudo (textos e números), comum ao Excel e ao PDF executivo,
 * para os dois formatos dizerem exatamente o mesmo.
 */
import { injecaoMensal } from "./engine";
import { scoreFatura } from "./fatura";
import { scorePainel } from "./painel";
import { usaValorPorSubgrupo, valorCompensado } from "./valor";
import type { Acao, LinhaRateio, Parametros, ResultadoProjeto, ResultadoUsina, Usina } from "./types";

export const fmt = (n: number, d = 0) => n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
export const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const ACAO_LABEL: Record<Acao, string> = { manter: "Manter", aumentar: "Aumentar", reduzir: "Reduzir", retirar: "Retirar", incluir: "Incluir" };
export const ACAO_EFEITO: Record<Acao, string> = {
  incluir: "Novas UCs que passam a receber crédito",
  retirar: "Saem do rateio (saldo cobre o consumo)",
  aumentar: "Recebem mais crédito",
  reduzir: "Recebem menos crédito (têm saldo ou recebiam demais)",
  manter: "Sem alteração",
};
export const ORDEM_ACOES: Acao[] = ["incluir", "retirar", "aumentar", "reduzir", "manter"];

export const LEGENDA_SITUACAO =
  "Situação hoje: Recebe demais = crédito maior que o consumo (vira saldo); Recebe pouco = crédito e saldo cobrem bem menos que a meta; Saldo parado = saldo acima do horizonte; Risco de vencer = saldo acima de 60 meses. Variação em pontos percentuais.";

export const AVISO_ESTIMATIVA =
  "Valores estimados a partir das médias de consumo, saldo e injeção informadas; sujeitos à validação na fatura após a aplicação pela distribuidora (vale a partir do ciclo seguinte ao pedido).";

export function protocoloEstudo(usinaNome: string, emissao: string): string {
  return `RAT-${emissao.split("/").reverse().join("")}-${usinaNome.replace(/^(UFV|CGH|PCH|EOL|UTE)\s+/i, "").replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase()}`;
}

export function subtituloUsina(u: Usina, r: ResultadoUsina): string {
  return `${r.usinaNome}${u.distribuidora ? ` · ${u.distribuidora}` : ""}${u.fornecedor ? ` · ${u.fornecedor}` : ""}`;
}

export function origemEnergia(u: Usina): string {
  if (u.fonteInjecao === "fatura" && u.fatura) {
    const s = scoreFatura(u.fatura, u.painel?.valores.injetada && u.painel.meses ? { kwh: u.painel.valores.injetada, meses: u.painel.meses } : null);
    return `Fatura da usina (confiança ${s.score}/100)`;
  }
  if (u.fontePeriodo === "painel" && u.painel) return `Tela do Orange (confiança ${scorePainel(u.painel, u.fatura?.injetada).score}/100)`;
  return "Informada no estudo";
}

export function identificacao(u: Usina, r: ResultadoUsina, metodo: ResultadoProjeto["metodo"]): [string, string][] {
  const i = r.indicadores;
  return [
    ["Usina", r.usinaNome],
    ["Distribuidora", u.distribuidora || "—"],
    ["Fornecedor", u.fornecedor || "—"],
    ["UCs no rateio", `${i.ucsAtuais} → ${i.ucsPropostas}`],
    ["Energia para rateio", `${fmt(injecaoMensal(u))} kWh/mês`],
    ["Origem da energia", origemEnergia(u)],
    ["Saldo atual das UCs", `${fmt(i.saldoTotal)} kWh`],
    ["Método", metodo === "otimizado" ? "Otimização matemática (ótimo comprovado)" : "Regra proporcional à necessidade"],
  ];
}

export interface Kpi {
  titulo: string;
  valor: string;
  nota: string;
  destaque: boolean;
}

export function kpisEstudo(r: ResultadoUsina, p: Parametros): Kpi[] {
  const ganho = r.proposto.compensadoTotal - r.atual.compensadoTotal;
  const vA = valorCompensado(r, "atual", p);
  const vP = valorCompensado(r, "proposto", p);
  const reais = vA != null && vP != null ? vP - vA : null;
  const notaReais = r.linhas.some((l) => l.tarifaKwh && l.tarifaKwh > 0) ? "tarifa típica das UCs" : usaValorPorSubgrupo(p) ? "valor do kWh por subgrupo" : `tarifa ${fmt(p.tarifaKwh, 2)} R$/kWh`;
  return [
    { titulo: "Energia compensada a mais", valor: `${ganho >= 0 ? "+" : ""}${fmt(ganho)} kWh`, nota: "vs. rateio atual", destaque: true },
    { titulo: "Ganho estimado", valor: reais != null ? brl(reais) : "—", nota: reais != null ? notaReais : "informe a tarifa no estudo", destaque: true },
    { titulo: "Crédito parado no fim", valor: `${fmt(r.proposto.saldoFinal)} kWh`, nota: `hoje ${fmt(r.atual.saldoInicial)} · sem mudar ${fmt(r.atual.saldoFinal)}`, destaque: false },
    { titulo: "Consumo sem crédito", valor: `${fmt(r.proposto.consumoDescobertoTotal)} kWh`, nota: `sem mudar: ${fmt(r.atual.consumoDescobertoTotal)}`, destaque: false },
  ];
}

export function condutaEstudo(r: ResultadoUsina): { acao: Acao; n: number; efeito: string }[] {
  return ORDEM_ACOES.map((a) => ({ acao: a, n: r.linhas.filter((l) => l.acao === a).length, efeito: ACAO_EFEITO[a] })).filter((x) => x.n > 0);
}

export function veredito(r: ResultadoUsina): { texto: string; nivel: "ok" | "aviso" | "erro" } {
  const reprov = r.validacoes.filter((v) => !v.ok && v.nivel === "erro").length;
  const avisos = r.validacoes.filter((v) => !v.ok && v.nivel === "aviso").length;
  if (reprov) return { texto: `${reprov} item(ns) reprovado(s): corrigir antes de enviar`, nivel: "erro" };
  if (avisos) return { texto: `Aprovado com ${avisos} aviso(s)`, nivel: "aviso" };
  return { texto: "Aprovado: pronto para envio", nivel: "ok" };
}

export function atencaoEstudo(r: ResultadoUsina) {
  return r.alertas.filter((a) => a.severidade !== "baixa").slice(0, 6);
}

/** UCs do maior para o menor consumo compensável (ordem do Anexo I). */
export function linhasAnexo(r: ResultadoUsina): LinhaRateio[] {
  return [...r.linhas].sort((a, b) => b.compensavelKwh - a.compensavelKwh || b.pctProposto - a.pctProposto);
}

export function resumoAnexo(u: Usina, r: ResultadoUsina, p: Parametros, emissao: string): string {
  const f = 10 ** p.casasDecimais;
  const soma = (k: "pctAtual" | "pctProposto") => Math.round(r.linhas.reduce((a, l) => a + l[k], 0) * f) / f;
  const atuais = r.linhas.filter((l) => l.origem === "atual").length;
  const novas = r.linhas.filter((l) => l.origem === "nova").length;
  return `${u.distribuidora ? `${u.distribuidora} · ` : ""}emitido em ${emissao} · hoje ${atuais} UCs (${fmt(soma("pctAtual"), p.casasDecimais)}%) → proposto ${r.indicadores.ucsPropostas} UCs (${fmt(soma("pctProposto"), p.casasDecimais)}%)${novas ? ` · ${novas} novas` : ""} · ordem: maior consumo compensável primeiro`;
}
