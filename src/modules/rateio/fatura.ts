/**
 * Leitura da fatura da usina (UC geradora) a partir do texto do PDF, linha a linha.
 *
 * Calibrada na fatura CELESC Grupo A de GD (histórico de 12 meses e demonstrativo de
 * créditos com colunas FP/PT), com leitura genérica por rótulos para outros layouts.
 * Tudo o que é lido aparece na tela para conferência antes de ir para o estudo.
 */
import { lerDemanda, type Demanda } from "./demanda";
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
  /** Demanda contratada, registrada e ultrapassagem do mês de referência (grupo A). */
  demanda?: Demanda | null;
  /** Injetada no mês de referência pela leitura do medidor (conferência). */
  injetadaMedidor?: number | null;
  /** Texto da fatura (linhas), para reler quando a leitura melhora sem precisar reenviar o PDF. */
  linhas?: string[];
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

/**
 * Histórico em gráfico de barras (RGE/CPFL e afins): um cabeçalho com as colunas
 * ("Consumo Ponta - [kWh]  Nº DIAS FAT  Consumo Fora de Ponta - [kWh] ...") e linhas
 * "JUL 26 llll 213,00 31  JUL 26 llll 1117,00 31 ...". Vira uma TabelaMensal.
 */
export function lerHistoricoGrafico(linhas: string[]): TabelaMensal[] {
  const tabelas: TabelaMensal[] = [];
  const MES_VAL = /\b([a-z]{3})[\s/.-]*(\d{2}|\d{4})\b[\s|l▮█■]*?\s(-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?)(?=\s|$)/gi;
  const limpa = (r: string) => norm(r.replace(/\[.*?\]/g, " ").replace(/\(.*?\)/g, " ")).replace(/[-–:]/g, " ").replace(/\bde\b/g, " ").replace(/\s+/g, " ").trim();
  for (let i = 0; i < linhas.length; i++) {
    const n = norm(linhas[i]);
    if (!/dias\s*fat|n[°º]?\s*dias/.test(n)) continue;
    const rotulos = linhas[i].split(/n[°º]?\s*dias\s*fat\.?/i).map(limpa).filter((r) => r && /[a-z]/.test(r));
    if (!rotulos.length) continue;
    const porRotulo = rotulos.map(() => new Map<string, number>());
    let j = i + 1;
    for (; j < linhas.length && j < i + 30; j++) {
      const ms = [...linhas[j].matchAll(MES_VAL)].map((m) => ({ mes: mesIso(`${m[1]}/${m[2]}`), v: toNumber(m[3]) })).filter((x) => x.mes);
      if (!ms.length) break;
      ms.slice(0, rotulos.length).forEach((x, k) => porRotulo[k].set(x.mes!, x.v));
    }
    const meses = [...new Set(porRotulo.flatMap((m) => [...m.keys()]))].sort().reverse();
    if (meses.length >= 2) {
      tabelas.push({ meses, linhas: rotulos.map((r, k) => ({ rotulo: r, valores: meses.map((m) => porRotulo[k].get(m) ?? 0) })) });
      i = j - 1;
    }
  }
  return tabelas;
}

/** Soma dos valores "Ponta" e "Fora Ponta" que seguem um rótulo, na mesma linha ou na seguinte. */
function somaPostos(linhas: string[], rotulo: RegExp): number | null {
  for (let i = 0; i < linhas.length; i++) {
    const n = norm(linhas[i]);
    if (!rotulo.test(n)) continue;
    const trecho = `${n.slice(n.search(rotulo))} ${norm(linhas[i + 1] ?? "")}`;
    const vals = [...trecho.matchAll(/(fora (?:de )?ponta|f\.? ?ponta|ponta)\s*:?\s*(-?[\d.]+(?:,\d+)?)\s*kwh/g)].map((m) => toNumber(m[2]));
    if (vals.length) return vals.slice(0, 2).reduce((a, b) => a + b, 0);
    const um = /(-?[\d.]+(?:,\d+)?)\s*kwh/.exec(trecho);
    if (um) return toNumber(um[1]);
  }
  return null;
}

/**
 * Valores do mês de referência em faturas sem tabela de injeção (RGE/CPFL e outras):
 * "kWh Injetado FPonta 124.580" + "Ponta 7", e a leitura do medidor de energia injetada
 * (leitura atual − anterior × constante = registrado), para conferência.
 */
export function lerMesSolto(linhas: string[]): { injetada: number | null; medidor: number | null } {
  let resumo = 0;
  let achouResumo = false;
  let medidor = 0;
  let achouMedidor = false;
  for (const l of linhas) {
    const n = norm(l);
    for (const m of n.matchAll(/kwh injetad[oa]\s*(?:f\.? ?ponta|fora (?:de )?ponta|ponta|total)?\s*:?\s*([\d.]+(?:,\d+)?)/g)) {
      resumo += toNumber(m[1]);
      achouResumo = true;
    }
    // medidor: "Energia Injetada - kW(h) Fora Ponta 347032 367795 6,00000 124.578"
    const md = /energia injetada.*?(?:fora (?:de )?ponta|ponta)\s+(\d+)\s+(\d+)\s+([\d.]+,\d+|\d+)\s+([\d.]+(?:,\d+)?)\s*$/.exec(n);
    if (md) {
      medidor += toNumber(md[4]);
      achouMedidor = true;
    }
  }
  return { injetada: achouResumo ? resumo : null, medidor: achouMedidor ? medidor : null };
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
  const tabelas = [...lerTabelasMensais(linhas), ...lerHistoricoGrafico(linhas)];
  const f: FaturaUsina = {
    arquivo,
    lidaEm: new Date().toISOString(),
    distribuidora: distribuidoraDoTexto(texto),
    mesReferencia: "",
    injetada: serie(tabelas, /^energia (ativa )?injetada( (fora )?ponta)?$|^energia injetada$/),
    excedente: serie(tabelas, /excedente.*distribu/),
    consumo: serie(tabelas, /^consumo( (fora )?ponta)?$/),
    saldoKwh: null,
    rateio: [],
    tabelas,
    avisos: [],
    demanda: lerDemanda(linhas),
    linhas,
  };

  // mês de referência: "Referência 09/2026", ou linha que começa com MM/AAAA seguida de uma data
  for (const l of linhas) {
    const n = norm(l);
    let m = /referencia[:\s]*(\d{1,2}\/\d{4}|[a-z]{3}\/\d{2,4})/.exec(n);
    if (!m) m = /^(\d{1,2}\/\d{4}|[a-z]{3}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}/.exec(n);
    if (!m) m = /(?:mes|mês)\s*(?:\/\s*ano|de referencia)?[:\s]+(\d{1,2}\/\d{4}|[a-z]{3}\/\d{2,4})/.exec(n);
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
  // sem tabela: "Saldo em Energia da Instalação: Ponta X kWh / Fora Ponta Y kWh" e afins
  if (f.saldoKwh == null) f.saldoKwh = somaPostos(linhas, /saldo (?:em energia|de energia|de creditos|acumulado)/);

  // mês solto (sem tabela de injeção): resumo "kWh Injetado" e leitura do medidor
  const solto = lerMesSolto(linhas);
  f.injetadaMedidor = solto.medidor;
  if (!Object.keys(f.injetada).length && f.mesReferencia) {
    const v = solto.injetada ?? solto.medidor;
    if (v != null && v > 0) f.injetada[f.mesReferencia] = v;
  }

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

/** Distribuidora pelo texto da fatura. */
export function distribuidoraDoTexto(texto: string): string {
  const t = norm(texto);
  const lista: [RegExp, string][] = [
    [/celesc/, "CELESC"],
    [/rge sul|\brge\b/, "RGE"],
    [/cpfl/, "CPFL"],
    [/cemig/, "CEMIG"],
    [/copel/, "COPEL"],
    [/\bceee\b|equatorial ceee/, "CEEE EQUATORIAL"],
    [/equatorial/, "EQUATORIAL"],
    [/energisa/, "ENERGISA"],
    [/neoenergia|coelba|celpe|cosern|elektro/, "NEOENERGIA"],
    [/\benel\b|eletropaulo|ampla|coelce/, "ENEL"],
    [/\bedp\b|bandeirante|escelsa/, "EDP"],
    [/\blight\b/, "LIGHT"],
  ];
  return lista.find(([re]) => re.test(t))?.[1] ?? "";
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
    desc.push(inj.length === 1 ? "Sazonalidade: a fatura traz só o mês de referência (precisa de 12 meses)" : `Sazonalidade: só ${inj.length} meses de operação no histórico (precisa de 12)`);
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

// ---------------------------------------------------------------------------
// Confiança da leitura

export interface ItemScore {
  ok: boolean;
  texto: string;
  pontos: number;
  max: number;
}

export interface ScoreLeitura {
  score: number;
  nivel: "alta" | "media" | "baixa";
  itens: ItemScore[];
}

export function nivelScore(score: number): ScoreLeitura["nivel"] {
  return score >= 80 ? "alta" : score >= 60 ? "media" : "baixa";
}

/** Nota de 0 a 100 da leitura da fatura: o que foi encontrado e se os números fecham entre si. */
export function scoreFatura(f: FaturaUsina, injetadaPainel?: { kwh: number; meses: number } | null): ScoreLeitura {
  const itens: ItemScore[] = [];
  const add = (ok: boolean, texto: string, max: number, pontos = ok ? max : 0) => itens.push({ ok, texto, pontos, max });
  const op = mesesEmOperacao(f.injetada);
  add(!!f.mesReferencia, f.mesReferencia ? `Mês de referência ${f.mesReferencia.slice(5, 7)}/${f.mesReferencia.slice(0, 4)}` : "Mês de referência não encontrado", 10);
  add(!!f.distribuidora, f.distribuidora ? `Distribuidora ${f.distribuidora}` : "Distribuidora não identificada", 5);
  add(op.length >= 6, op.length === 1 ? "Injetada só do mês de referência (sem histórico na fatura)" : `${op.length} meses de injeção em operação no histórico`, 25, op.length >= 6 ? 25 : op.length >= 3 ? 15 : op.length ? 12 : 0);
  const exc = Object.keys(f.excedente);
  add(exc.length > 0, exc.length ? `Excedente distribuído em ${exc.length} meses` : "Sem o excedente distribuído (usa injeção − consumo)", 15, exc.length ? 15 : 5);
  // excedente ≈ injetada − consumo da usina (fecha a conta mês a mês)
  const pares = exc.filter((m) => f.injetada[m] > 0);
  if (pares.length) {
    const erros = pares.map((m) => Math.abs(f.injetada[m] - (f.consumo[m] ?? 0) - f.excedente[m]) / f.injetada[m]);
    const pior = Math.max(...erros);
    add(pior <= 0.03, `Injetada − consumo da usina = excedente (maior diferença ${(pior * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)`, 20, pior <= 0.03 ? 20 : pior <= 0.1 ? 10 : 0);
  } else if (f.injetadaMedidor && f.mesReferencia && f.injetada[f.mesReferencia] > 0 && f.injetada[f.mesReferencia] !== f.injetadaMedidor) {
    // conferência independente: resumo da fatura × leitura do medidor
    const dif = Math.abs(f.injetada[f.mesReferencia] - f.injetadaMedidor) / f.injetada[f.mesReferencia];
    add(dif <= 0.01, `Injetada confere com a leitura do medidor (${(dif * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}% de diferença)`, 20, dif <= 0.01 ? 20 : dif <= 0.05 ? 10 : 0);
  } else add(false, "Sem meses para conferir injetada × excedente", 20, 8);
  const coerente = op.every(([m, v]) => (f.excedente[m] ?? 0) <= v * 1.001);
  add(coerente, coerente ? "Excedente nunca passa da injetada" : "Excedente maior que a injetada em algum mês", 10);
  const nInj = Object.values(f.injetada).filter((v) => v > 0).length;
  if (injetadaPainel && injetadaPainel.kwh > 0 && nInj < injetadaPainel.meses / 2) {
    add(false, "Fatura com menos meses que a tela do Orange: sem como comparar", 15, 8);
  } else if (injetadaPainel && injetadaPainel.kwh > 0) {
    const soma = Object.entries(f.injetada).filter(([, v]) => v > 0).sort(([a], [b]) => a.localeCompare(b)).slice(-injetadaPainel.meses).reduce((a, [, v]) => a + v, 0);
    const dif = Math.abs(soma - injetadaPainel.kwh) / injetadaPainel.kwh;
    add(dif <= 0.03, `Bate com a injetada da tela do Orange (${(dif * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% de diferença)`, 15, dif <= 0.03 ? 15 : dif <= 0.1 ? 7 : 0);
  } else add(false, "Sem a tela do Orange para conferir", 15, 8);
  const max = itens.reduce((a, i) => a + i.max, 0);
  const score = Math.round((itens.reduce((a, i) => a + i.pontos, 0) / max) * 100);
  return { score, nivel: nivelScore(score), itens };
}
