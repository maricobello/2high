/**
 * Refino exato do rateio otimizado na precisão aceita pela distribuidora.
 *
 * O objetivo do otimizador se separa por UC: o saldo de uma UC não passa para outra, então
 * o valor total é Σ_i F_i(x_i), e cada F_i é côncava no percentual x_i (energia usada de um
 * estoque cresce cada vez menos; saldo encalhado e afastamento do rateio atual crescem cada vez
 * mais). Maximizar uma soma de funções côncavas com Σ x = 100 numa grade inteira (0,01%) tem
 * uma propriedade forte: um ponto em que nenhuma troca de uma unidade entre duas UCs melhora
 * é o ótimo global. O refino parte do ótimo contínuo (MILP) arredondado e faz trocas de 1%,
 * 0,1% … até a unidade da grade, até nenhuma melhorar. Resultado: o ótimo exato do mesmo
 * objetivo na grade da distribuidora, para o conjunto de UCs que o MILP escolheu.
 */

import type { Parametros } from "./types";

/**
 * Penalidade (por kWh) de terminar abaixo da reserva. Pequena de propósito: guardar crédito
 * não tem valor econômico (é dinheiro parado); a reserva só desempata soluções equivalentes.
 */
export const PESO_RESERVA = 0.05;

/** Constantes do objetivo, as mesmas no MILP (otimizador.ts) e no refino exato. */
export function constantesObjetivo(p: Pick<Parametros, "fatorConsumoEstresse">): ConstantesObjetivo {
  return {
    cenarios: [
      { peso: 0.6, fator: 1 },
      { peso: 0.4, fator: p.fatorConsumoEstresse },
    ],
    beta: 1, // saldo acima da reserva no fim conta como crédito perdido
    delta: 0.25, // peso da estabilidade por kWh/mês movido
    pesoReserva: PESO_RESERVA,
  };
}

export interface ItemRefino {
  comp: number;
  saldo: number;
  /** Percentual atual (para o termo de estabilidade). */
  pct0: number;
  /** Peso de valor (R$/kWh relativo; 1 sem valores por subgrupo). */
  valor: number;
  /** Reserva de saldo (kWh). */
  reserva: number;
  /** false = fora do rateio (fica em 0%). */
  ativo: boolean;
}

export interface ConstantesObjetivo {
  cenarios: { peso: number; fator: number }[];
  /** Peso do saldo acima da reserva no fim (crédito perdido). */
  beta: number;
  /** Peso (por kWh/mês movido) da estabilidade em relação ao rateio atual. */
  delta: number;
  /** Penalidade por kWh abaixo da reserva (desempate). */
  pesoReserva: number;
}

/**
 * Valor (kWh equivalentes) de uma UC com percentual `pct`, idêntico ao objetivo do MILP:
 * Σ_s peso_s·v·(usado − β·max(0, saldo_fim − reserva)) − penal. reserva − δ·Ē/100·|pct − pct0|.
 */
export function valorUc(it: ItemRefino, pct: number, E: number[], k: ConstantesObjetivo): number {
  const T = E.length;
  let total = 0;
  let creditoTotal = 0;
  for (const s of k.cenarios) {
    const cons = Math.max(0, it.comp) * s.fator;
    let saldo = Math.max(0, it.saldo);
    let usado = 0;
    creditoTotal = 0;
    for (let t = 0; t < T; t++) {
      const cred = (pct / 100) * E[t];
      creditoTotal += cred;
      const uso = Math.min(cons, cred + saldo);
      saldo += cred - uso;
      usado += uso;
    }
    total += s.peso * it.valor * (usado - k.beta * Math.max(0, saldo - it.reserva));
  }
  // reserva (como no MILP: crédito do horizonte ≥ consumo − (saldo − reserva), cenário médio)
  if (it.reserva > 0 && it.saldo > 0) {
    const rhs = Math.max(0, it.comp) * T - (it.saldo - Math.min(it.saldo, it.reserva));
    if (rhs > 0) total -= k.pesoReserva * Math.max(0, rhs - creditoTotal);
  }
  const Emed = E.reduce((a, b) => a + b, 0) / Math.max(1, T);
  return total - ((k.delta * Emed) / 100) * Math.abs(pct - it.pct0);
}

export interface ResultadoRefino {
  pct: number[];
  /** Objetivo antes (arredondado) e depois do refino. */
  antes: number;
  depois: number;
  trocas: number;
}

/**
 * Parte de `inicial` (percentuais na grade, soma 100) e troca unidades entre UCs ativas
 * enquanto houver ganho. Respeita o mínimo por UC ativa.
 */
export function refinarRateio(itens: ItemRefino[], inicial: number[], E: number[], k: ConstantesObjetivo, casas: number, pctMinimo: number): ResultadoRefino {
  const escala = 10 ** casas;
  const un = inicial.map((p) => Math.round(p * escala));
  const totalUn = 100 * escala;
  const pmin = Math.max(1, Math.round(pctMinimo * escala));
  const lb = un.map((u, i) => (itens[i].ativo ? Math.min(u, pmin) : u));
  const ativos = itens.map((it, i) => i).filter((i) => itens[i].ativo);
  const f = (i: number, u: number) => valorUc(itens[i], u / escala, E, k);
  const atual = un.map((u, i) => f(i, u));
  const antes = atual.reduce((a, b) => a + b, 0);
  let trocas = 0;
  if (ativos.length >= 2 && un.reduce((a, b) => a + b, 0) === totalUn) {
    // passos: 1%, 0,1%, … até a unidade da grade
    const passos: number[] = [];
    for (let s = escala; s >= 1; s = Math.floor(s / 10)) passos.push(s);
    if (!passos.length) passos.push(1);
    const EPS = 1e-7;
    for (const s of passos) {
      const ganho = new Map<number, number>(); // ganho de +s
      const perda = new Map<number, number>(); // perda de −s
      const calc = (i: number) => {
        ganho.set(i, un[i] + s <= totalUn ? f(i, un[i] + s) - atual[i] : -Infinity);
        perda.set(i, un[i] - s >= lb[i] ? atual[i] - f(i, un[i] - s) : Infinity);
      };
      ativos.forEach(calc);
      for (let iter = 0; iter < 200000; iter++) {
        // melhor par (i recebe, j cede), i ≠ j: dois melhores de cada lado bastam
        let g1 = -1, g2 = -1, p1 = -1, p2 = -1;
        for (const i of ativos) {
          const g = ganho.get(i)!;
          if (g1 < 0 || g > ganho.get(g1)!) {
            g2 = g1;
            g1 = i;
          } else if (g2 < 0 || g > ganho.get(g2)!) g2 = i;
          const pp = perda.get(i)!;
          if (p1 < 0 || pp < perda.get(p1)!) {
            p2 = p1;
            p1 = i;
          } else if (p2 < 0 || pp < perda.get(p2)!) p2 = i;
        }
        let bi = -1;
        let j = -1;
        let melhor = -Infinity;
        for (const [x, y] of [[g1, p1], [g1, p2], [g2, p1]] as const) {
          if (x < 0 || y < 0 || x === y) continue;
          const d = ganho.get(x)! - perda.get(y)!;
          if (d > melhor) {
            melhor = d;
            bi = x;
            j = y;
          }
        }
        const bg = bi < 0 ? -Infinity : ganho.get(bi)!;
        const pj = j < 0 ? Infinity : perda.get(j)!;
        if (bi < 0 || j < 0 || !(bg - pj > EPS)) break;
        un[bi] += s;
        un[j] -= s;
        atual[bi] = f(bi, un[bi]);
        atual[j] = f(j, un[j]);
        calc(bi);
        calc(j);
        trocas++;
      }
    }
  }
  const depois = atual.reduce((a, b) => a + b, 0);
  return { pct: un.map((u) => u / escala), antes, depois, trocas };
}
