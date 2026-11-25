/**
 * "Máximo compensável": quanto do consumo compensável de cada UC o crédito novo cobre.
 *
 * - No método otimizado ele é livre: o modelo (MILP) escolhe o percentual de cada UC que
 *   maximiza a energia compensada; o máximo compensável é um resultado (coberturaEfetiva).
 * - Na regra proporcional e na planilha modelo ele é um parâmetro. Para esses dois casos,
 *   o valor ótimo sai de uma busca livre (sem faixa fixa: de ~0% a 200%, do grosso para o
 *   fino até 0,1 ponto) com a projeção completa em cada ponto e o mesmo critério do
 *   otimizador: energia compensada esperada (consumo médio 60%, consumo menor 40%) menos um
 *   custo por UC incluída.
 */
import { analisarProjeto, arredondarRateio, injecaoMensal, simular } from "./engine";
import type { Candidata, Parametros, ResultadoUsina, Usina } from "./types";

export interface PontoCobertura {
  cobertura: number;
  valor: number;
  compensadoMedio: number;
  compensadoEstresse: number;
  incluidas: number;
}

export interface SugestaoCobertura {
  cobertura: number;
  /** Ganho esperado (kWh no período) do ótimo em relação ao valor atual. */
  ganhoKwh: number;
  atual: PontoCobertura;
  melhor: PontoCobertura;
  curva: PontoCobertura[];
}

const PESO_MEDIO = 0.6;
const TOL = 1; // kWh: diferenças menores que isso são empate

function melhorDaCurva(curva: PontoCobertura[], referencia: number): PontoCobertura {
  const max = Math.max(...curva.map((c) => c.valor));
  // empate: fica com o valor mais perto do atual (não mexe no que não faz diferença)
  return curva.filter((c) => c.valor >= max - TOL).reduce((a, b) => (Math.abs(b.cobertura - referencia) < Math.abs(a.cobertura - referencia) ? b : a));
}

function pontoMaisProximo(curva: PontoCobertura[], v: number): PontoCobertura {
  return curva.reduce((a, b) => (Math.abs(b.cobertura - v) < Math.abs(a.cobertura - v) ? b : a));
}

function avaliarProporcional(usinas: Usina[], candidatas: Candidata[], p: Parametros, cobertura: number): PontoCobertura {
  const r = analisarProjeto(usinas, candidatas, { ...p, cobertura, metodo: "proporcional" });
  const medio = r.usinas.reduce((a, u) => a + u.proposto.compensadoTotal, 0);
  const estresse = r.usinas.reduce((a, u) => a + u.propostoEstresse.compensadoTotal, 0);
  const incluidas = r.usinas.reduce((a, u) => a + u.indicadores.incluidas, 0);
  return { cobertura, valor: PESO_MEDIO * medio + (1 - PESO_MEDIO) * estresse - p.custoNovaUcKwh * incluidas, compensadoMedio: medio, compensadoEstresse: estresse, incluidas };
}

/**
 * Busca livre (do grosso para o fino) num intervalo: grade de 5 pontos, depois de 1 ponto em
 * volta dos 3 melhores, depois de 0,1 ponto em volta do melhor. A curva não é côncava (tem
 * vales), por isso começa com a grade inteira e refina mais de um candidato.
 */
function buscaLivre(avaliar: (c: number) => PontoCobertura, min: number, max: number, referencia: number): { melhor: PontoCobertura; curva: PontoCobertura[] } {
  const vistos = new Map<number, PontoCobertura>();
  const r1 = (v: number) => Math.round(v * 1000) / 1000;
  const ponto = (c: number) => {
    const k = r1(Math.min(max, Math.max(min, c)));
    if (!vistos.has(k)) vistos.set(k, avaliar(k));
    return vistos.get(k)!;
  };
  for (let c = min; c <= max + 1e-9; c += 0.05) ponto(c);
  ponto(max);
  ponto(referencia);
  const top = (n: number) => [...vistos.values()].sort((a, b) => b.valor - a.valor).slice(0, n);
  for (const t of top(3)) for (let d = -0.04; d <= 0.04 + 1e-9; d += 0.01) ponto(t.cobertura + d);
  const m = top(1)[0];
  for (let d = -0.009; d <= 0.009 + 1e-9; d += 0.001) ponto(m.cobertura + d);
  const curva = [...vistos.values()].sort((a, b) => a.cobertura - b.cobertura);
  return { melhor: melhorDaCurva(curva, referencia), curva };
}

/** Faixa da busca do máximo compensável (livre: abaixo e acima de 100%). */
export const FAIXA_COBERTURA = { min: 0.01, max: 2 } as const;

/** Máximo compensável ótimo da regra proporcional, busca livre de 1% a 200%. Pesado (~3 s com 300 UCs): rode num worker. */
export function sugerirCobertura(usinas: Usina[], candidatas: Candidata[], p: Parametros): SugestaoCobertura | null {
  const validas = usinas.filter((u) => u.ucs.length && injecaoMensal(u) > 0);
  if (!validas.length) return null;
  const { melhor, curva } = buscaLivre((c) => avaliarProporcional(validas, candidatas, p, c), FAIXA_COBERTURA.min, FAIXA_COBERTURA.max, p.cobertura);
  const atual = pontoMaisProximo(curva, p.cobertura);
  return { cobertura: melhor.cobertura, ganhoKwh: melhor.compensadoMedio - atual.compensadoMedio, atual, melhor, curva };
}

// ---------------------------------------------------------------------------
// Regra da planilha modelo (colunas L a N da "Análise do Rateio")

export interface LinhaPlanilha {
  saldo: number;
  comp: number;
}

/**
 * Percentuais que a planilha modelo calcula para um "Máximo Compensável" (M8):
 *   L = saldo × 30% se (compensável total + agregado > injeção), senão 0
 *   M = L > compensável ? compensável × M8 : compensável − L
 *   N = M ÷ ΣM
 */
export function rateioPlanilha(linhas: LinhaPlanilha[], injecao: number, agregado: number, maximo: number, p: Pick<Parametros, "casasDecimais" | "pctMinimo">): number[] {
  const compTotal = linhas.reduce((a, l) => a + l.comp, 0);
  const queima = compTotal + agregado > injecao;
  const m = linhas.map((l) => {
    const usoSaldo = l.saldo > 0 && queima ? l.saldo * 0.3 : 0;
    return Math.max(0, usoSaldo > l.comp ? l.comp * maximo : l.comp - usoSaldo);
  });
  if (m.reduce((a, b) => a + b, 0) <= 0) return linhas.map(() => 0);
  return arredondarRateio(m, p.casasDecimais, p.pctMinimo);
}

export interface SugestaoPlanilha extends SugestaoCobertura {
  /** Energia compensada (cenário médio) do rateio do sistema, para comparação. */
  compensadoSistema: number;
  /** UCs afetadas pelo máximo compensável (as que gastariam mais saldo que o compensável). */
  ucsAfetadas: number;
}

/**
 * "Máximo Compensável" ótimo para a planilha modelo, com as UCs do rateio proposto
 * (atuais que ficam + novas incluídas). `referencia` é o valor que a planilha usa hoje.
 */
export function sugerirMaximoPlanilha(u: Usina, r: ResultadoUsina, p: Parametros, referencia = 0.9): SugestaoPlanilha | null {
  const E = injecaoMensal(u);
  const linhas = r.linhas.filter((l) => l.origem === "atual" || l.pctProposto > 0);
  if (E <= 0 || !linhas.length) return null;
  const base = linhas.map((l) => ({ saldo: Math.max(0, l.saldoKwh), comp: Math.max(0, l.compensavelKwh) }));
  const agregado = r.indicadores.compensavelAgregado;
  const compTotal = base.reduce((a, l) => a + l.comp, 0);
  const ucsAfetadas = compTotal + agregado > E ? base.filter((l) => l.saldo * 0.3 > l.comp).length : 0;
  const avaliar = (m: number): PontoCobertura => {
    const pct = rateioPlanilha(base, E, agregado, m, p);
    const sim = base.map((l, i) => ({ pct: pct[i], saldo: l.saldo, comp: l.comp }));
    const medio = simular(sim, u, p).compensadoTotal;
    const estresse = simular(sim, u, p, p.fatorConsumoEstresse).compensadoTotal;
    return { cobertura: m, valor: PESO_MEDIO * medio + (1 - PESO_MEDIO) * estresse, compensadoMedio: medio, compensadoEstresse: estresse, incluidas: 0 };
  };
  // sem UC afetada o M8 não muda nada: não precisa buscar
  const { melhor, curva } = ucsAfetadas ? buscaLivre(avaliar, 0, FAIXA_COBERTURA.max, referencia) : { melhor: avaliar(referencia), curva: [avaliar(referencia)] };
  const atual = pontoMaisProximo(curva, referencia);
  return { cobertura: melhor.cobertura, ganhoKwh: melhor.compensadoMedio - atual.compensadoMedio, atual, melhor, curva, compensadoSistema: r.proposto.compensadoTotal, ucsAfetadas };
}

/** Quanto do consumo compensável o crédito novo cobre de fato, no rateio proposto (ou atual). */
export function coberturaEfetiva(r: ResultadoUsina, qual: "atual" | "proposto"): number | null {
  const linhas = qual === "atual" ? r.linhas.filter((l) => l.origem === "atual" && l.pctAtual > 0) : r.linhas.filter((l) => l.pctProposto > 0);
  const comp = linhas.reduce((a, l) => a + Math.max(0, l.compensavelKwh), 0);
  if (comp <= 0) return null;
  const cred = linhas.reduce((a, l) => a + (qual === "atual" ? l.creditoAtualKwh : l.creditoPropostoKwh), 0);
  return cred / comp;
}

/**
 * Limite físico da energia compensada no período (cenário médio): cada UC usa no máximo o
 * próprio consumo; o saldo de uma UC só serve a ela; a injeção do período é o resto.
 * Nenhum rateio passa disso — serve de régua para "quão perto do melhor possível".
 */
export function limiteFisico(r: ResultadoUsina, qual: "atual" | "proposto", meses: number): number {
  const linhas = qual === "atual" ? r.linhas.filter((l) => l.origem === "atual") : r.linhas;
  const injetado = (qual === "atual" ? r.atual : r.proposto).injetadoTotal;
  let doSaldo = 0;
  let falta = 0;
  for (const l of linhas) {
    const cons = Math.max(0, l.compensavelKwh) * meses;
    const s = Math.min(cons, Math.max(0, l.saldoKwh));
    doSaldo += s;
    falta += cons - s;
  }
  return doSaldo + Math.min(injetado, falta);
}
