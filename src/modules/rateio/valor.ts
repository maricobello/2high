/**
 * Valor do kWh compensado por UC (foco em lucro). Grupo A e Grupo B compensam a tarifas
 * diferentes: quando falta energia, o crédito rende mais onde o kWh vale mais.
 * Sem valores informados, todo kWh vale o mesmo (peso 1).
 */
import type { Parametros, ResultadoUsina } from "./types";

/** Subgrupo assumido para candidatas (mono/bi/trifásicas = baixa tensão). */
export const SUBGRUPO_CANDIDATA = "B";

/** Chave de subgrupo: "b3 " -> "B3"; vazio -> "". */
export function chaveSubgrupo(s: string): string {
  return (s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** R$/kWh de uma UC pelo subgrupo (exato, depois só a letra A/B, depois a tarifa média). null = sem valor. */
export function valorKwh(subgrupo: string, p: Pick<Parametros, "valorKwhSubgrupo" | "tarifaKwh">): number | null {
  const mapa = p.valorKwhSubgrupo ?? {};
  const k = chaveSubgrupo(subgrupo);
  const v = mapa[k] ?? mapa[k.slice(0, 1)];
  if (v != null && v > 0) return v;
  return p.tarifaKwh > 0 ? p.tarifaKwh : null;
}

/** Há valores por subgrupo informados (o objetivo passa a ser em R$). */
export function usaValorPorSubgrupo(p: Pick<Parametros, "valorKwhSubgrupo">): boolean {
  return Object.values(p.valorKwhSubgrupo ?? {}).some((v) => v > 0);
}

/** Item para o peso de valor: subgrupo e, quando a lista traz, o R$/kWh da própria UC. */
export type ItemValor = string | { subgrupo: string; tarifa?: number | null };

const subOf = (x: ItemValor) => (typeof x === "string" ? x : x.subgrupo);
const tarOf = (x: ItemValor) => (typeof x === "string" ? null : x.tarifa && x.tarifa > 0 ? x.tarifa : null);

/** Há R$/kWh por UC ou por subgrupo: o objetivo passa a ser em R$ (lucro). */
export function usaValor(p: Pick<Parametros, "valorKwhSubgrupo">, itens: ItemValor[] = []): boolean {
  return usaValorPorSubgrupo(p) || itens.some((x) => tarOf(x) != null);
}

/**
 * Pesos relativos (média 1) do valor do kWh de cada UC para o objetivo do otimizador.
 * Prioridade: R$/kWh da própria UC; depois o valor do subgrupo; depois a média das tarifas
 * conhecidas (UCs novas, sem tarifa). Sem nenhum valor, todos 1 (objetivo em kWh).
 */
export function pesosValor(itens: ItemValor[], p: Pick<Parametros, "valorKwhSubgrupo" | "tarifaKwh">): number[] {
  if (!itens.length || !usaValor(p, itens)) return itens.map(() => 1);
  const conhecidas = itens.map(tarOf).filter((t): t is number => t != null);
  const informados = Object.values(p.valorKwhSubgrupo ?? {}).filter((v) => v > 0);
  const padrao = p.tarifaKwh > 0 ? p.tarifaKwh : conhecidas.length ? conhecidas.reduce((a, b) => a + b, 0) / conhecidas.length : informados.reduce((a, b) => a + b, 0) / informados.length;
  const v = itens.map((x) => tarOf(x) ?? (usaValorPorSubgrupo(p) ? valorKwh(subOf(x), { ...p, tarifaKwh: padrao }) : null) ?? padrao);
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  return v.map((x) => (media > 0 ? x / media : 1));
}

/** Itens de valor das linhas de um resultado (UCs atuais com tarifa; novas como grupo B). */
export function itensValor(r: Pick<ResultadoUsina, "linhas">): ItemValor[] {
  return r.linhas.map((l) => (l.origem === "nova" ? { subgrupo: SUBGRUPO_CANDIDATA } : { subgrupo: l.subgrupo, tarifa: l.tarifaKwh }));
}

/**
 * Valor em R$ da energia compensada no período (cenário médio), UC a UC: R$/kWh da UC, senão
 * do subgrupo, senão a tarifa média. null quando não há nenhum valor.
 */
export function valorCompensado(r: ResultadoUsina, qual: "atual" | "proposto", p: Pick<Parametros, "valorKwhSubgrupo" | "tarifaKwh">): number | null {
  const temUc = r.linhas.some((l) => l.tarifaKwh && l.tarifaKwh > 0);
  if (!(p.tarifaKwh > 0) && !usaValorPorSubgrupo(p) && !temUc) return null;
  const tarifas = r.linhas.map((l) => l.tarifaKwh).filter((t): t is number => !!t && t > 0);
  const media = p.tarifaKwh > 0 ? p.tarifaKwh : tarifas.length ? tarifas.reduce((a, b) => a + b, 0) / tarifas.length : 0;
  const cen = qual === "atual" ? r.atual : r.proposto;
  let total = 0;
  cen.compensadoPorUc.forEach((kwh, i) => {
    const l = r.linhas[i];
    const t = l?.tarifaKwh && l.tarifaKwh > 0 ? l.tarifaKwh : (valorKwh(l ? (l.origem === "nova" ? SUBGRUPO_CANDIDATA : l.subgrupo) : "", { ...p, tarifaKwh: media }) ?? 0);
    total += kwh * t;
  });
  return total;
}
