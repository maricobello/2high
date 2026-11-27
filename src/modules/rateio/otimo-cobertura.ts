/**
 * "Máximo compensável": quanto do consumo compensável de cada UC o crédito novo cobre.
 * Não existe valor padrão: ele é sempre calculado.
 *
 * - No método otimizado ele é livre por UC: o modelo (MILP + refino exato) escolhe o
 *   percentual de cada UC; o máximo compensável é um resultado (coberturaEfetiva).
 * - Na regra proporcional e na planilha modelo (M8) ele é um parâmetro da fórmula. O valor
 *   sai de uma busca livre (0% a 200%, do grosso para o fino até 0,1 ponto) com a projeção
 *   completa em cada ponto e o MESMO critério do otimizador: compensação (desconto) das UCs
 *   nos cenários de consumo médio e menor, valor do kWh por subgrupo, saldo encalhado no fim
 *   (crédito perdido), reserva de saldo e estabilidade em relação ao rateio atual.
 */
import { analisarProjeto, arredondarRateio, injecaoMensal, serieInjecao, simular } from "./engine";
import { constantesObjetivo, valorUc } from "./refinar";
import type { Candidata, LinhaRateio, Parametros, ResultadoUsina, Usina } from "./types";
import { pesosValor, SUBGRUPO_CANDIDATA } from "./valor";

export interface PontoCobertura {
  cobertura: number;
  /** Objetivo do otimizador (kWh equivalentes; maior é melhor). */
  valor: number;
  compensadoMedio: number;
  compensadoEstresse: number;
  saldoFinal: number;
  incluidas: number;
  /** Planilha: distância (Σ|Δ p.p.|) até o rateio do sistema. */
  distancia?: number;
  /** Proporcional: cobertura que de fato acontece no rateio resultante (crédito ÷ compensável). */
  efetiva?: number;
}

export interface SugestaoCobertura {
  cobertura: number;
  /** Ganho esperado (kWh no período) do ótimo em relação ao valor comparado. */
  ganhoKwh: number;
  atual: PontoCobertura;
  melhor: PontoCobertura;
  curva: PontoCobertura[];
}

const TOL = 1; // kWh equivalentes: diferenças menores que isso são empate

/** Objetivo do otimizador para um conjunto de linhas com os percentuais dados. */
function objetivo(u: Usina, linhas: LinhaRateio[], pct: number[], p: Parametros): number {
  const E = serieInjecao(u, p);
  const K = constantesObjetivo(p);
  const vals = pesosValor(linhas.map((l) => (l.origem === "nova" ? { subgrupo: SUBGRUPO_CANDIDATA } : { subgrupo: l.subgrupo, tarifa: l.tarifaKwh })), p);
  return linhas.reduce(
    (a, l, i) => a + valorUc({ comp: l.compensavelKwh, saldo: l.saldoKwh, pct0: l.pctAtual, valor: vals[i], reserva: p.reservaSaldoMeses * Math.max(0, l.compensavelKwh), ativo: true }, pct[i], E, K),
    0,
  );
}

type Desempate = (a: PontoCobertura, b: PontoCobertura) => number;
/** Desempate padrão: mais energia compensada, depois menos saldo parado no fim. */
const porEnergia: Desempate = (a, b) => b.compensadoMedio - a.compensadoMedio || a.saldoFinal - b.saldoFinal;

function melhorDaCurva(curva: PontoCobertura[], desempate: Desempate): PontoCobertura {
  const max = Math.max(...curva.map((c) => c.valor));
  return [...curva.filter((c) => c.valor >= max - TOL)].sort(desempate)[0];
}

function pontoMaisProximo(curva: PontoCobertura[], v: number): PontoCobertura {
  return curva.reduce((a, b) => (Math.abs(b.cobertura - v) < Math.abs(a.cobertura - v) ? b : a));
}

function avaliarProporcional(usinas: Usina[], candidatas: Candidata[], p: Parametros, cobertura: number): PontoCobertura {
  const r = analisarProjeto(usinas, candidatas, { ...p, cobertura, metodo: "proporcional" });
  let valor = 0;
  for (const ru of r.usinas) {
    const u = usinas.find((x) => x.id === ru.usinaId);
    if (u) valor += objetivo(u, ru.linhas, ru.linhas.map((l) => l.pctProposto), p);
  }
  const incluidas = r.usinas.reduce((a, u) => a + u.indicadores.incluidas, 0);
  const ativas = r.usinas.flatMap((u) => u.linhas.filter((l) => l.pctProposto > 0));
  const comp = ativas.reduce((a, l) => a + Math.max(0, l.compensavelKwh), 0);
  return {
    cobertura,
    efetiva: comp > 0 ? ativas.reduce((a, l) => a + l.creditoPropostoKwh, 0) / comp : undefined,
    valor: valor - p.custoNovaUcKwh * incluidas,
    compensadoMedio: r.usinas.reduce((a, u) => a + u.proposto.compensadoTotal, 0),
    compensadoEstresse: r.usinas.reduce((a, u) => a + u.propostoEstresse.compensadoTotal, 0),
    saldoFinal: r.usinas.reduce((a, u) => a + u.proposto.saldoFinal, 0),
    incluidas,
  };
}

/**
 * Busca livre (do grosso para o fino): grade de 5 pontos no intervalo todo, depois 1 ponto em
 * volta dos 3 melhores, depois 0,1 ponto em volta do melhor. A curva não é côncava (tem
 * vales), por isso varre o intervalo inteiro e refina mais de um candidato.
 */
function buscaLivre(avaliar: (c: number) => PontoCobertura, min: number, max: number, desempate: Desempate): { melhor: PontoCobertura; curva: PontoCobertura[] } {
  const vistos = new Map<number, PontoCobertura>();
  const r1 = (v: number) => Math.round(v * 1000) / 1000;
  const ponto = (c: number) => {
    const k = r1(Math.min(max, Math.max(min, c)));
    if (!vistos.has(k)) vistos.set(k, avaliar(k));
    return vistos.get(k)!;
  };
  for (let c = min; c <= max + 1e-9; c += 0.05) ponto(c);
  ponto(max);
  const top = (n: number) => [...vistos.values()].sort((a, b) => b.valor - a.valor || desempate(a, b)).slice(0, n);
  for (const t of top(3)) for (let d = -0.04; d <= 0.04 + 1e-9; d += 0.01) ponto(t.cobertura + d);
  const m = top(1)[0];
  for (let d = -0.009; d <= 0.009 + 1e-9; d += 0.001) ponto(m.cobertura + d);
  const curva = [...vistos.values()].sort((a, b) => a.cobertura - b.cobertura);
  return { melhor: melhorDaCurva(curva, desempate), curva };
}

/** Faixa da busca do máximo compensável (livre: abaixo e acima de 100%). */
export const FAIXA_COBERTURA = { min: 0.01, max: 2 } as const;

/** Máximo compensável ótimo da regra proporcional, busca livre de 1% a 200%. Pesado (~3 s com 300 UCs): rode num worker. */
export function sugerirCobertura(usinas: Usina[], candidatas: Candidata[], p: Parametros): SugestaoCobertura | null {
  const validas = usinas.filter((u) => u.ucs.length && injecaoMensal(u) > 0);
  if (!validas.length) return null;
  // empate (curva plana): fica o valor coerente com o que acontece de fato (cobertura ≈ efetiva)
  const coerente: Desempate = (a, b) => Math.abs(a.cobertura - (a.efetiva ?? a.cobertura)) - Math.abs(b.cobertura - (b.efetiva ?? b.cobertura)) || porEnergia(a, b);
  const { melhor, curva } = buscaLivre((c) => avaliarProporcional(validas, candidatas, p, c), FAIXA_COBERTURA.min, FAIXA_COBERTURA.max, coerente);
  // comparação com o valor em uso (só para mostrar o ganho; não influencia a escolha)
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
  /**
   * true = nenhuma UC passa pela regra do M8 (a fórmula dá o mesmo rateio para qualquer valor):
   * vai o máximo compensável efetivo do rateio do sistema.
   */
  semEfeito: boolean;
}

/**
 * "Máximo Compensável" (M8) ótimo para a planilha modelo, com as UCs do rateio proposto
 * (atuais + novas incluídas). Sem valor padrão: com UCs afetadas, busca livre de 0% a 200%
 * pelo objetivo do otimizador; empate fica com o valor cuja fórmula mais se aproxima do
 * rateio do sistema. Sem UC afetada, o M8 não muda a fórmula e recebe o máximo compensável
 * efetivo do rateio do sistema. `anterior` (o valor que a planilha usava) só serve para
 * mostrar o ganho.
 */
export function sugerirMaximoPlanilha(u: Usina, r: ResultadoUsina, p: Parametros, anterior?: number | null): SugestaoPlanilha | null {
  const E = injecaoMensal(u);
  const linhas = r.linhas.filter((l) => l.origem === "atual" || l.pctProposto > 0);
  if (E <= 0 || !linhas.length) return null;
  const base = linhas.map((l) => ({ saldo: Math.max(0, l.saldoKwh), comp: Math.max(0, l.compensavelKwh) }));
  const agregado = r.indicadores.compensavelAgregado;
  const compTotal = base.reduce((a, l) => a + l.comp, 0);
  const ucsAfetadas = compTotal + agregado > E ? base.filter((l) => l.saldo * 0.3 > l.comp).length : 0;
  const alvo = linhas.map((l) => l.pctProposto);
  const avaliar = (m: number): PontoCobertura => {
    const pct = rateioPlanilha(base, E, agregado, m, p);
    const sim = base.map((l, i) => ({ pct: pct[i], saldo: l.saldo, comp: l.comp }));
    const med = simular(sim, u, p);
    return {
      cobertura: m,
      valor: objetivo(u, linhas, pct, p),
      compensadoMedio: med.compensadoTotal,
      compensadoEstresse: simular(sim, u, p, p.fatorConsumoEstresse).compensadoTotal,
      saldoFinal: med.saldoFinal,
      incluidas: 0,
      distancia: pct.reduce((a, x, i) => a + Math.abs(x - alvo[i]), 0),
    };
  };
  const pertoDoSistema: Desempate = (a, b) => (a.distancia ?? 0) - (b.distancia ?? 0) || porEnergia(a, b);
  let melhor: PontoCobertura;
  let curva: PontoCobertura[];
  if (ucsAfetadas) ({ melhor, curva } = buscaLivre(avaliar, 0, FAIXA_COBERTURA.max, pertoDoSistema));
  else {
    const ef = coberturaEfetiva(r, "proposto");
    melhor = avaliar(ef != null ? Math.round(ef * 1000) / 1000 : 1);
    curva = [melhor];
  }
  const atual = anterior != null ? avaliar(anterior) : melhor;
  return { cobertura: melhor.cobertura, ganhoKwh: melhor.compensadoMedio - atual.compensadoMedio, atual, melhor, curva, compensadoSistema: r.proposto.compensadoTotal, ucsAfetadas, semEfeito: !ucsAfetadas };
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
