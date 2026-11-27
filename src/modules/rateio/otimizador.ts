/**
 * Rateio ótimo por programação linear inteira mista (MILP), resolvida com HiGHS.
 *
 * Por que funciona: todas as UCs são do mesmo cliente, então o que importa no total
 * é quanto crédito é usado e quanto fica parado. Para cada usina, a energia
 * compensada no período é igual a injeção + saldo inicial − saldo final; logo,
 * maximizar a compensação é minimizar o saldo que sobra. O saldo, porém, é de cada
 * UC (não passa de uma para outra), e é aí que o modelo trabalha UC por UC, mês a mês.
 *
 * Variáveis (por usina u):
 *   x[u,i]  percentual da UC i (0..100)               — atuais e candidatas
 *   a[s,u,i,t] crédito usado pela UC i no mês t, no cenário s (0..consumo)
 *   e[s,u,i] saldo acima da reserva no fim do horizonte
 *   d[u,i]  mudança em relação ao percentual atual (estabilidade)
 *   z[u,j]  candidata j entra na usina u (binária); k[u,i] UC atual fica (binária)
 *
 * Restrições:
 *   Σ_i x[u,i] = 100
 *   saldo nunca negativo: Σ_{τ≤t} a[s,u,i,τ] − x[u,i]·Σ_{τ≤t} E[u,τ]/100 ≤ S0[i]
 *   e[s,u,i] ≥ S0[i] + x·ΣE/100 − Σ_t a − reserva[i]
 *   reserva (cenário médio): crédito do horizonte ≥ consumo − (saldo − reserva), só como desempate
 *   mínimo por UC: x ≥ mín·k (ou ≥ mín se não pode retirar), x ≤ 100·k
 *   candidata: x ≤ 100·z, x ≥ mín·z, e cada candidata em no máximo uma usina
 *
 * Objetivo (kWh): Σ_s peso_s·( −Σ a + β·Σ e ) + γ·Σ z + δ·Ē/100·Σ d
 *   = minimizar saldo encalhado (robusto ao cenário de consumo menor),
 *     com custo por nova UC e preferência por mudar pouco o rateio atual.
 */
import { chaveEntradas, injecaoMensal, normalizarPerfil } from "./engine";
import type { CandidataAvaliada, OtimizacaoResultado, Parametros, Usina } from "./types";
import { norm } from "./normalize";
import { limiteNovasPeloContrato } from "./contrato";
import { constantesObjetivo, PESO_RESERVA } from "./refinar";
import { pesosValor, SUBGRUPO_CANDIDATA } from "./valor";

export interface ModeloLp {
  chave: string;
  lp: string;
  variaveis: number;
  restricoes: number;
  /** Para ler a solução: nomes das colunas de percentual por usina. */
  mapa: { usinaId: string; atuais: string[]; candidatas: { key: string; col: string; bin: string }[] }[];
}

/** Opções do solver (mesmo formato do HiGHS). */
/** Tolerância de 1e-6: na prática, ótimo exato (na base de teste, mesma resposta com 0,2% e 0%). */
export const OPCOES_SOLVER = { time_limit: 25, mip_rel_gap: 1e-6, presolve: "on", output_flag: false } as const;

export { PESO_RESERVA };

const num = (v: number) => {
  if (!Number.isFinite(v)) return "0";
  const r = Math.abs(v) < 1e-12 ? 0 : v;
  return Number(r.toPrecision(10)).toString();
};

function compat(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  return !x || !y || x.includes(y) || y.includes(x);
}

export function montarModelo(usinas: Usina[], candidatas: CandidataAvaliada[], p: Parametros): ModeloLp {
  const T = Math.max(1, p.mesesSimulacao);
  const { cenarios, beta, delta } = constantesObjetivo(p);
  const gamma = p.custoNovaUcKwh; // custo (kWh) de incluir uma UC
  const pmin = p.pctMinimo;

  const obj: string[] = [];
  const rows: string[] = [];
  const bounds: string[] = [];
  const bins: string[] = [];
  let nVars = 0;
  const mapa: ModeloLp["mapa"] = [];
  const elegiveis = candidatas.filter((c) => c.elegivel);
  const candUsinas = new Map<string, string[]>(); // key -> colunas binárias (no máximo uma usina)

  usinas.forEach((u, ui) => {
    if (!u.ucs.length) return;
    const E0 = injecaoMensal(u);
    if (E0 <= 0) return;
    const perfil = normalizarPerfil(u.perfilSazonal);
    const E = Array.from({ length: T }, (_, t) => E0 * perfil[(((Math.round(p.mesInicio) - 1 + t) % 12) + 12) % 12]);
    const Ecum = E.reduce<number[]>((acc, v) => [...acc, (acc.at(-1) ?? 0) + v], []);
    const Emed = Ecum[T - 1] / T;

    type Uc = { col: string; comp: number; saldo: number; reserva: number; pct0: number; valor: number; bin?: string; cand?: string };
    // base grande (milhares de UCs): o modelo só leva as maiores que podem caber (até 2× o espaço
    // do contrato ou da injeção, no máximo 120); com todas, o modelo fica enorme e trava
    const limNovas = limiteNovasPeloContrato(u, p.metaContrato);
    const teto = 2 * Math.min(limNovas ?? Infinity, E0);
    let acumulado = 0;
    const cands = p.incluirNovasUcs
      ? elegiveis
          .filter((c) => compat(c.candidata.concessionaria, u.distribuidora))
          .sort((a, b) => b.candidata.compensavelKwh - a.candidata.compensavelKwh)
          .filter((c, i) => i < 120 && (acumulado += c.candidata.compensavelKwh) - c.candidata.compensavelKwh <= teto)
      : [];
    // valor do kWh por UC (foco em lucro); candidatas são de baixa tensão (grupo B)
    const vals = pesosValor([...u.ucs.map((c) => c.subgrupo), ...cands.map(() => SUBGRUPO_CANDIDATA)], p);
    const lista: Uc[] = u.ucs.map((c, i) => ({ col: `x${ui}_${i}`, comp: Math.max(0, c.compensavelKwh), saldo: Math.max(0, c.saldoKwh), reserva: p.reservaSaldoMeses * Math.max(0, c.compensavelKwh), pct0: c.pctAtual, valor: vals[i] }));
    const mapaCands: ModeloLp["mapa"][number]["candidatas"] = [];
    cands.forEach((c, j) => {
      const col = `y${ui}_${j}`;
      const bin = `z${ui}_${j}`;
      lista.push({ col, comp: c.candidata.compensavelKwh, saldo: 0, reserva: 0, pct0: 0, valor: vals[u.ucs.length + j], bin, cand: c.candidata.key });
      mapaCands.push({ key: c.candidata.key, col, bin });
      candUsinas.set(c.candidata.key, [...(candUsinas.get(c.candidata.key) ?? []), bin]);
    });
    mapa.push({ usinaId: u.id, atuais: lista.filter((l) => !l.cand).map((l) => l.col), candidatas: mapaCands });
    // contrato: compensável das novas UCs até a meta de carga da usina
    const lim = limNovas;
    if (lim != null && mapaCands.length) rows.push(` ct${ui}: ${cands.map((c, j) => `+ ${num(c.candidata.compensavelKwh)} z${ui}_${j}`).join(" ")} <= ${num(lim)}`);

    rows.push(` soma${ui}: ${lista.map((l) => `+ ${l.col}`).join(" ")} = 100`);

    lista.forEach((l, i) => {
      nVars++;
      bounds.push(` 0 <= ${l.col} <= 100`);
      // estabilidade
      const d = `d${ui}_${i}`;
      nVars++;
      obj.push(`+ ${num((delta * Emed) / 100)} ${d}`);
      rows.push(` dp${ui}_${i}: ${d} - ${l.col} >= ${num(-l.pct0)}`);
      rows.push(` dn${ui}_${i}: ${d} + ${l.col} >= ${num(l.pct0)}`);
      // mínimo / inclusão
      if (l.bin) {
        nVars++;
        bins.push(` ${l.bin}`);
        obj.push(`+ ${num(gamma)} ${l.bin}`);
        rows.push(` cz${ui}_${i}: ${l.col} - 100 ${l.bin} <= 0`);
        rows.push(` cm${ui}_${i}: ${l.col} - ${num(pmin)} ${l.bin} >= 0`);
      } else if (p.permitirRetirar && (l.comp <= 0 || l.saldo >= l.comp * 3)) {
        // retirar só pode render para UC sem consumo ou com saldo grande; nas demais, sem binária
        // (o modelo fica muito menor e resolve rápido em usinas com centenas de UCs)
        const k = `k${ui}_${i}`;
        nVars++;
        bins.push(` ${k}`);
        rows.push(` ck${ui}_${i}: ${l.col} - 100 ${k} <= 0`);
        rows.push(` cn${ui}_${i}: ${l.col} - ${num(pmin)} ${k} >= 0`);
      } else {
        rows.push(` cn${ui}_${i}: ${l.col} >= ${num(pmin)}`);
      }
      // dinâmica do saldo por cenário
      cenarios.forEach((s, si) => {
        const cons = l.comp * s.fator;
        const as: string[] = [];
        for (let t = 0; t < T; t++) {
          const a = `a${si}_${ui}_${i}_${t}`;
          as.push(a);
          nVars++;
          bounds.push(` 0 <= ${a} <= ${num(cons)}`);
          obj.push(`- ${num(s.peso * l.valor)} ${a}`);
          rows.push(` s${si}_${ui}_${i}_${t}: ${as.map((v) => `+ ${v}`).join(" ")} - ${num(Ecum[t] / 100)} ${l.col} <= ${num(l.saldo)}`);
        }
        // reserva (cenário médio): o saldo é gasto sozinho sempre que falta crédito, então
        // só o percentual garante a reserva: crédito no horizonte ≥ consumo − (saldo − reserva).
        // Exigência flexível (v ≥ 0 com penalidade) para não ficar impossível quando falta energia.
        if (si === 0 && l.reserva > 0 && l.saldo > 0) {
          const rhs = cons * T - (l.saldo - Math.min(l.saldo, l.reserva));
          if (rhs > 0) {
            const v = `v${ui}_${i}`;
            nVars++;
            obj.push(`+ ${num(PESO_RESERVA)} ${v}`);
            rows.push(` r${ui}_${i}: ${num(Ecum[T - 1] / 100)} ${l.col} + ${v} >= ${num(rhs)}`);
          }
        }
        const e = `e${si}_${ui}_${i}`;
        nVars++;
        obj.push(`+ ${num(s.peso * beta * l.valor)} ${e}`);
        rows.push(` f${si}_${ui}_${i}: ${e} - ${num(Ecum[T - 1] / 100)} ${l.col} ${as.map((v) => `+ ${v}`).join(" ")} >= ${num(l.saldo - l.reserva)}`);
      });
    });
  });

  // cada candidata em no máximo uma usina
  let c = 0;
  for (const [, cols] of candUsinas) if (cols.length > 1) rows.push(` uma${c++}: ${cols.map((b) => `+ ${b}`).join(" ")} <= 1`);

  const wrap = (terms: string[]) => {
    const out: string[] = [];
    for (let i = 0; i < terms.length; i += 40) out.push(` ${terms.slice(i, i + 40).join(" ")}`);
    return out.join("\n");
  };
  const lp = [
    "Minimize",
    ` obj:\n${wrap(obj.length ? obj : ["0 dummy"])}`,
    "Subject To",
    ...rows.map((r) => (r.length > 4000 ? r.replace(/(.{1,3500})( [+-] )/g, "$1\n$2") : r)),
    "Bounds",
    ...bounds,
    ...(bins.length ? ["Binary", ...bins] : []),
    "End",
  ].join("\n");

  return { chave: chaveEntradas(usinas, candidatas, p), lp, variaveis: nVars, restricoes: rows.length, mapa };
}

type Colunas = Record<string, { Primal: number }>;

export function interpretarSolucao(modelo: ModeloLp, status: string, objetivo: number, colunas: Colunas, tempoMs: number): OtimizacaoResultado {
  const otimo = status === "Optimal";
  const usavel = otimo || (status === "Time limit reached" && Object.keys(colunas).length > 0);
  const porUsina: OtimizacaoResultado["porUsina"] = {};
  if (usavel) {
    for (const m of modelo.mapa) {
      const v = (col: string) => Math.max(0, colunas[col]?.Primal ?? 0);
      porUsina[m.usinaId] = {
        pctAtuais: m.atuais.map(v),
        novas: m.candidatas.filter((c) => (colunas[c.bin]?.Primal ?? 0) > 0.5 && v(c.col) > 1e-9).map((c) => ({ key: c.key, pct: v(c.col) })),
      };
    }
  }
  return { chave: modelo.chave, status, otimo, objetivo, tempoMs, variaveis: modelo.variaveis, restricoes: modelo.restricoes, porUsina, erro: usavel ? undefined : `Solver: ${status}` };
}
