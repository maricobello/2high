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

/**
 * Pesos relativos (média 1 entre as UCs listadas) para o objetivo do otimizador.
 * Sem valores por subgrupo, todos 1.
 */
export function pesosValor(subgrupos: string[], p: Pick<Parametros, "valorKwhSubgrupo" | "tarifaKwh">): number[] {
  if (!usaValorPorSubgrupo(p) || !subgrupos.length) return subgrupos.map(() => 1);
  const informados = Object.values(p.valorKwhSubgrupo ?? {}).filter((v) => v > 0);
  const padrao = p.tarifaKwh > 0 ? p.tarifaKwh : informados.reduce((a, b) => a + b, 0) / informados.length;
  const v = subgrupos.map((s) => valorKwh(s, { ...p, tarifaKwh: padrao }) ?? padrao);
  const media = v.reduce((a, b) => a + b, 0) / v.length;
  return v.map((x) => (media > 0 ? x / media : 1));
}

/**
 * Valor em R$ da energia compensada no período (cenário médio), UC a UC.
 * null quando não há tarifa média nem valores por subgrupo.
 */
export function valorCompensado(r: ResultadoUsina, qual: "atual" | "proposto", p: Pick<Parametros, "valorKwhSubgrupo" | "tarifaKwh">): number | null {
  if (!(p.tarifaKwh > 0) && !usaValorPorSubgrupo(p)) return null;
  const cen = qual === "atual" ? r.atual : r.proposto;
  let total = 0;
  cen.compensadoPorUc.forEach((kwh, i) => {
    const l = r.linhas[i];
    total += kwh * (valorKwh(l ? (l.origem === "nova" ? SUBGRUPO_CANDIDATA : l.subgrupo) : "", p) ?? 0);
  });
  return total;
}
