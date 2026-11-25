/**
 * Leitura da fatura da usina (UC geradora) a partir do texto do PDF, linha a linha.
 *
 * Calibrada na fatura CELESC Grupo A de GD (histórico de 12 meses e demonstrativo de
 * créditos com colunas FP/PT), com leitura genérica por rótulos para outros layouts.
 * Tudo o que é lido aparece na tela para conferência antes de ir para o estudo.
 */
import { norm, toNumber, ucKey } from "./normalize";

export interface SerieMensal {
  /** "AAAA-MM" → kWh */
  [mes: string]: number;
}

export interface TabelaMensal {
  meses: string[];
  /** Valores por mês em cada linha (soma dos postos quando há FP/PT). */
  linhas: { rotulo: string; valores: number[] }[];
}

export interface RateioFatura {
  instalacao: string;
  key: string;
  pct: number;
}

export interface FaturaUsina {
  arquivo: string;
  lidaEm: string;
  distribuidora: string;
  mesReferencia: string;
  /** Energia injetada na rede por mês (FP + PT). */
  injetada: SerieMensal;
  /** Excedente distribuído às UCs do rateio por mês (o que de fato é rateado). */
  excedente: SerieMensal;
  /** Consumo da própria usina por mês. */
  consumo: SerieMensal;
  /** Saldo de créditos da geradora no mês de referência. */
  saldoKwh: number | null;
  rateio: RateioFatura[];
  tabelas: TabelaMensal[];
  avisos: string[];
}

const MES: Record<string, string> = { jan: "01", fev: "02", mar: "03", abr: "04", mai: "05", jun: "06", jul: "07", ago: "08", set: "09", out: "10", nov: "11", dez: "12" };

/** "SET/26", "SET/2026", "09/2026" → "2026-09". */
export function mesIso(token: string): string | null {
  const t = norm(token).replace(/\s/g, "");
  let m = /^([a-z]{3})[a-z]*[/.\-]?(\d{2}|\d{4})$/.exec(t);
  if (m && MES[m[1]]) return `${m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])}-${MES[m[1]]}`;
  m = /^(\d{1,2})[/.\-](\d{4})$/.exec(t);
  if (m && Number(m[1]) >= 1 && Number(m[1]) <= 12) return `${m[2]}-${String(Number(m[1])).padStart(2, "0")}`;
  return null;
}

// números BR ("7.970.400,00", "2,45", "376376") e negativos com sinal no fim ("902-")
const NUM_RE = /-?\d{1,3}(?:\.\d{3})+(?:,\d+)?-?|-?\d+,\d+-?|-?\d+-?/g;
function numeros(txt: string): number[] {
  return (txt.match(NUM_RE) ?? []).map((s) => (s.endsWith("-") ? -toNumber(s.slice(0, -1)) : toNumber(s)));
}

function tokensDeMes(linha: string): string[] {
  return linha.split(/\s+/).map(mesIso).filter((m): m is string => !!m);
}

/** Tabelas com cabeçalho de meses ("SET/26 AGO/26 ...") seguido de linhas "rótulo valores". */
export function lerTabelasMensais(linhas: string[]): TabelaMensal[] {
  const tabelas: TabelaMensal[] = [];
  for (let i = 0; i < linhas.length; i++) {
    const meses = tokensDeMes(linhas[i]);
    if (meses.length < 3 || numeros(linhas[i].replace(/[a-z]{3}\/\d{2,4}/gi, "")).length > 0) continue;
    let j = i + 1;
    let postos = 1;
    const sub = norm(linhas[j] ?? "").split(/\s+/);
    if (sub.length >= meses.length * 2 && sub.every((t) => /^(fp|pt|hp|hfp|ponta|fora)$/.test(t))) {
      postos = 2;
      j++;
    }
    const tab: TabelaMensal = { meses, linhas: [] };
    for (; j < linhas.length && j < i + 40; j++) {
      const l = linhas[j];
      if (tokensDeMes(l).length >= 3) break;
      const m = /^([^\d]+?)\s+(-?\d[\s\S]*)$/.exec(l);
      if (!m) {
        if (tab.linhas.length) break;
        continue;
      }
      const vals = numeros(m[2]);
      const n = meses.length * postos;
      if (vals.length < n) {
        if (tab.linhas.length) break;
        continue;
      }
      // os meses ficam no fim da linha (antes podem vir leituras e o mês faturado)
      const fim = vals.slice(-n);
      const porMes = meses.map((_, k) => fim.slice(k * postos, k * postos + postos).reduce((a, b) => a + b, 0));
      tab.linhas.push({ rotulo: m[1].trim(), valores: porMes });
    }
    if (tab.linhas.length) {
      tabelas.push(tab);
      i = j - 1;
    }
  }
  return tabelas;
}

/** Soma, por mês, as linhas cujo rótulo casa com `incluir` (e não com `excluir`), na tabela com mais meses. */
function serie(tabelas: TabelaMensal[], incluir: RegExp, excluir?: RegExp): SerieMensal {
  const cands = tabelas
    .map((t) => ({ t, ls: t.linhas.filter((l) => incluir.test(norm(l.rotulo)) && !(excluir && excluir.test(norm(l.rotulo)))) }))
    .filter((x) => x.ls.length)
    .sort((a, b) => b.t.meses.length - a.t.meses.length);
  const out: SerieMensal = {};
  // junta as tabelas: a de mais meses primeiro; as outras só completam meses que faltam
  for (const { t, ls } of cands) {
    t.meses.forEach((m, k) => {
      if (out[m] != null) return;
      out[m] = ls.reduce((a, l) => a + l.valores[k], 0);
    });
  }
  return out;
}

export function lerFaturaTexto(linhasBrutas: string[], arquivo = "fatura.pdf"): FaturaUsina {
  const linhas = linhasBrutas.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);
  const texto = norm(linhas.join("\n"));
  const tabelas = lerTabelasMensais(linhas);
  const f: FaturaUsina = {
    arquivo,
    lidaEm: new Date().toISOString(),
    distribuidora: /celesc/.test(texto) ? "CELESC" : (/\b(cemig|copel|cpfl|enel|edp|light|equatorial|energisa|neoenergia|coelba|celpe)\b/.exec(texto)?.[1].toUpperCase() ?? ""),
    mesReferencia: "",
    injetada: serie(tabelas, /^energia (ativa )?injetada( (fora )?ponta)?$|^energia injetada$/),
    excedente: serie(tabelas, /excedente.*distribu/),
    consumo: serie(tabelas, /^consumo( (fora )?ponta)?$/),
    saldoKwh: null,
    rateio: [],
    tabelas,
    avisos: [],
  };

  // mês de referência: "Referência 09/2026", ou linha que começa com MM/AAAA seguida de uma data
  for (const l of linhas) {
    const n = norm(l);
    let m = /referencia[:\s]*(\d{1,2}\/\d{4}|[a-z]{3}\/\d{2,4})/.exec(n);
    if (!m) m = /^(\d{1,2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}/.exec(n);
    const iso = m ? mesIso(m[1]) : null;
    if (iso) {
      f.mesReferencia = iso;
      break;
    }
  }
  if (!f.mesReferencia) {
    const todos = Object.keys(f.injetada).sort();
    f.mesReferencia = todos.at(-1) ?? "";
  }

  // saldo de créditos da geradora (demonstrativo) no mês de referência
  const saldo = serie(tabelas, /saldo de creditos (atualizado|final|acumulado)/);
  if (Object.keys(saldo).length) f.saldoKwh = saldo[f.mesReferencia] ?? saldo[Object.keys(saldo).sort().at(-1)!];

  // leitura genérica por rótulo quando não há tabela (outros layouts)
  if (!Object.keys(f.injetada).length && f.mesReferencia) {
    for (const l of linhas) {
      const n = norm(l);
      const m = /(energia injetada|injecao total|kwh injetad)/.exec(n);
      if (!m) continue;
      const v = numeros(n.slice(m.index + m[0].length).replace(/\d{1,2}\/\d{2,4}/g, " "))[0];
      if (v != null && v > 0) {
        f.injetada[f.mesReferencia] = v;
        break;
      }
    }
  }

  // lista de rateio: linhas com número de UC e percentual
  const vistos = new Set<string>();
  for (const l of linhas) {
    const m = /(\d[\d.\-/]{5,}\d)\D{0,40}?(\d{1,3}(?:[.,]\d{1,6})?)\s*%/.exec(l);
    if (!m || /^\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}$/.test(m[1])) continue;
    const key = ucKey(m[1]);
    if (key.length < 6 || vistos.has(key)) continue;
    const pct = toNumber(m[2].replace(".", ","));
    if (!(pct > 0 && pct <= 100)) continue;
    vistos.add(key);
    f.rateio.push({ instalacao: m[1], key, pct });
  }

  if (!Object.keys(f.injetada).length) f.avisos.push("Não encontrei a energia injetada na fatura.");
  if (!Object.keys(f.excedente).length && Object.keys(f.injetada).length) f.avisos.push("Sem o excedente distribuído: o estudo usa a injeção menos o consumo da usina.");
  return f;
}

/** Meses em operação: tira os zerados e o mês parcial de entrada em operação. */
export function mesesEmOperacao(s: SerieMensal): [string, number][] {
  const pares = Object.entries(s).sort(([a], [b]) => a.localeCompare(b));
  const pos = pares.filter(([, v]) => v > 0).map(([, v]) => v).sort((a, b) => a - b);
  if (!pos.length) return [];
  const mediana = pos[Math.floor(pos.length / 2)];
  const inicio = pares.findIndex(([, v]) => v >= mediana * 0.5);
  return pares.slice(inicio).filter(([, v]) => v > 0);
}

export interface AplicacaoFatura {
  /** kWh/mês disponível para o rateio (excedente distribuído; ou injetada − consumo). */
  injecaoMensal: number | null;
  base: "excedente" | "injetada" | null;
  mesesUsados: string[];
  perfilSazonal: number[];
  descricao: string[];
}

export function aplicacaoDaFatura(f: FaturaUsina): AplicacaoFatura {
  const desc: string[] = [];
  let base: AplicacaoFatura["base"] = null;
  // meses em operação pela injeção; em cada um, o excedente distribuído quando a fatura traz,
  // senão injeção − consumo da usina
  const opInj = mesesEmOperacao(f.injetada);
  const opExc = mesesEmOperacao(f.excedente);
  const meses = [...new Set([...opInj.map(([m]) => m), ...opExc.map(([m]) => m)])].sort().slice(-12);
  const usar = meses.map((m) => [m, f.excedente[m] ?? Math.max(0, (f.injetada[m] ?? 0) - (f.consumo[m] ?? 0))] as [string, number]).filter(([, v]) => v > 0);
  const nExc = usar.filter(([m]) => f.excedente[m] != null).length;
  if (usar.length) base = nExc === usar.length ? "excedente" : nExc ? "excedente" : "injetada";
  const injecaoMensal = usar.length ? usar.reduce((a, [, v]) => a + v, 0) / usar.length : null;
  if (injecaoMensal != null)
    desc.push(
      `Energia para o rateio: média de ${usar.length} ${usar.length === 1 ? "mês" : "meses"} em operação = ${Math.round(injecaoMensal).toLocaleString("pt-BR")} kWh/mês (${nExc === usar.length ? "excedente distribuído" : nExc ? `excedente distribuído em ${nExc} meses e injeção menos consumo da usina nos outros` : "injeção menos consumo da usina"})`,
    );
  // sazonalidade pela injeção (série mais longa), se houver os 12 meses do ano
  const inj = mesesEmOperacao(f.injetada).slice(-24);
  const porMes = new Map<number, number[]>();
  for (const [m, v] of inj) porMes.set(Number(m.slice(5, 7)), [...(porMes.get(Number(m.slice(5, 7))) ?? []), v]);
  let perfilSazonal: number[] = [];
  if (porMes.size === 12) {
    perfilSazonal = Array.from({ length: 12 }, (_, i) => porMes.get(i + 1)!.reduce((a, b) => a + b, 0) / porMes.get(i + 1)!.length);
    desc.push("Sazonalidade pelos 12 meses do histórico de injeção");
  } else if (inj.length) {
    desc.push(`Sazonalidade: só ${inj.length} meses de operação no histórico (precisa de 12)`);
  }
  return { injecaoMensal, base, mesesUsados: usar.map(([m]) => m), perfilSazonal, descricao: desc };
}

export interface DivergenciaRateio {
  soNaFatura: RateioFatura[];
  soNoOrange: { key: string; instalacao: string; pct: number }[];
  diferentes: { key: string; instalacao: string; fatura: number; orange: number }[];
  iguais: number;
}

/** Compara o rateio vigente na fatura com a lista do Orange. */
export function compararRateio(fatura: RateioFatura[], orange: { key: string; instalacao: string; pctAtual: number }[]): DivergenciaRateio {
  const porKey = new Map(orange.map((o) => [o.key, o]));
  const naFatura = new Set(fatura.map((r) => r.key));
  const d: DivergenciaRateio = { soNaFatura: [], soNoOrange: [], diferentes: [], iguais: 0 };
  for (const r of fatura) {
    const o = porKey.get(r.key);
    if (!o) d.soNaFatura.push(r);
    else if (Math.abs(o.pctAtual - r.pct) > 0.005) d.diferentes.push({ key: r.key, instalacao: o.instalacao, fatura: r.pct, orange: o.pctAtual });
    else d.iguais++;
  }
  for (const o of orange) if (o.pctAtual > 0 && !naFatura.has(o.key)) d.soNoOrange.push({ key: o.key, instalacao: o.instalacao, pct: o.pctAtual });
  return d;
}
