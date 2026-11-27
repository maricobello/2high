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
 * R$/kWh por subgrupo a partir da coluna "R$/kWh" das UCs: a MEDIANA do subgrupo. A coluna do
 * Orange é o preço médio da conta (fatura ÷ kWh): em UC pequena os custos fixos inflam o valor
 * (R$ 3 a 8/kWh), mas o crédito só abate a energia, cuja tarifa é a mesma no subgrupo. A mediana
 * do subgrupo dá a tarifa típica sem essa distorção.
 */
export function tarifaPorSubgrupo(itens: ItemValor[]): { porSub: Map<string, number>; geral: number | null } {
  const grupos = new Map<string, number[]>();
  const todas: number[] = [];
  for (const x of itens) {
    const t = tarOf(x);
    if (t == null) continue;
    const k = chaveSubgrupo(subOf(x)) || "?";
    grupos.set(k, [...(grupos.get(k) ?? []), t]);
    todas.push(t);
  }
  const mediana = (v: number[]) => {
    const o = [...v].sort((a, b) => a - b);
    const m = Math.floor(o.length / 2);
    return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
  };
  const porSub = new Map<string, number>();
  // subgrupo com poucas UCs (< 5) usa a mediana geral: amostra pequena demais
  for (const [k, v] of grupos) if (v.length >= 5) porSub.set(k, mediana(v));
  return { porSub, geral: todas.length ? mediana(todas) : null };
}

/**
 * Pesos relativos (média 1) do valor do kWh de cada UC para o objetivo do otimizador.
 * Prioridade: valor informado por subgrupo; senão a tarifa típica do subgrupo pela coluna
 * R$/kWh das UCs (mediana); senão todos 1 (objetivo em kWh).
 */
export function pesosValor(itens: ItemValor[], p: Pick<Parametros, "valorKwhSubgrupo" | "tarifaKwh">): number[] {
  // Só pesa quando o valor por subgrupo foi informado. A coluna "R$/kWh" do Orange é o preço
  // médio da conta (não a tarifa): nas faturas, B1 e B3 da mesma distribuidora têm a mesma
  // tarifa de energia. Sem valor informado, todo kWh vale o mesmo (máximo kWh = máximo R$).
  if (!itens.length || !usaValorPorSubgrupo(p)) return itens.map(() => 1);
  const informados = Object.values(p.valorKwhSubgrupo ?? {}).filter((x) => x > 0);
  const padrao = p.tarifaKwh > 0 ? p.tarifaKwh : informados.reduce((a, b) => a + b, 0) / informados.length;
  const v = itens.map((x) => valorKwh(subOf(x), { ...p, tarifaKwh: padrao }) ?? padrao);
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
  const itens = itensValor(r);
  const { geral } = tarifaPorSubgrupo(itens);
  if (!(p.tarifaKwh > 0) && !usaValorPorSubgrupo(p) && geral == null) return null;
  const cen = qual === "atual" ? r.atual : r.proposto;
  let total = 0;
  cen.compensadoPorUc.forEach((kwh, i) => {
    const l = r.linhas[i];
    const sub = l ? (l.origem === "nova" ? SUBGRUPO_CANDIDATA : l.subgrupo) : "";
    // sem tarifa informada: uma tarifa só para a usina (mediana da coluna R$/kWh das UCs)
    const t = usaValorPorSubgrupo(p) || p.tarifaKwh > 0 ? (valorKwh(sub, p) ?? 0) : (geral ?? 0);
    total += kwh * t;
  });
  return total;
}
