/**
 * Energia consumida no período (Relatório Gerencial GD do Orange): o total de cada
 * competência é digitado mês a mês; a planilha modelo soma e tira a média do período.
 */
import { toNumber } from "./normalize";
import type { ConsumoMes, Usina } from "./types";

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const LIMITE = 24;

function iso(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Competências (AAAA-MM) do período da análise, da mais antiga para a mais recente. */
export function competencias(u: Pick<Usina, "periodoInicio" | "periodoFim" | "meses">): string[] {
  const ini = /^(\d{4})-(\d{2})/.exec(u.periodoInicio ?? "");
  const fim = /^(\d{4})-(\d{2})/.exec(u.periodoFim ?? "");
  if (!fim) return [];
  const fa = Number(fim[1]);
  const fm = Number(fim[2]);
  let n: number;
  if (ini) n = (fa - Number(ini[1])) * 12 + (fm - Number(ini[2])) + 1;
  else n = Math.round(u.meses || 0);
  if (!(n > 0)) return [];
  n = Math.min(n, LIMITE);
  const out: string[] = [];
  for (let k = n - 1; k >= 0; k--) {
    const t = fa * 12 + (fm - 1) - k;
    out.push(iso(Math.floor(t / 12), (t % 12) + 1));
  }
  return out;
}

/** "2026-09" → "set/26". */
export function rotuloCompetencia(c: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(c);
  return m ? `${MESES[Number(m[2]) - 1]}/${m[1].slice(2)}` : c;
}

/** Converte o rótulo guardado (AAAA-MM, "SET", "set/26") para a competência do período. */
function competenciaDoRotulo(rotulo: string, periodo: string[]): string | null {
  if (/^\d{4}-\d{2}$/.test(rotulo)) return rotulo;
  const m = /^([a-z]{3})(?:\/(\d{2}))?$/i.exec(rotulo.trim());
  if (!m) return null;
  const mes = MESES.indexOf(m[1].toLowerCase()) + 1;
  if (!mes) return null;
  const cands = periodo.filter((c) => Number(c.slice(5, 7)) === mes && (!m[2] || c.slice(2, 4) === m[2]));
  return cands.length ? cands[cands.length - 1] : null; // o mais recente com esse mês
}

export interface LinhaConsumo {
  competencia: string;
  kwh: number | null;
}

/** Uma linha por competência do período, com o que foi informado. */
export function consumoPorCompetencia(u: Pick<Usina, "periodoInicio" | "periodoFim" | "meses" | "consumoMensal">): LinhaConsumo[] {
  const periodo = competencias(u);
  const mapa = new Map<string, number>();
  for (const c of u.consumoMensal ?? []) {
    const k = competenciaDoRotulo(c.mes, periodo);
    if (k && Number.isFinite(c.kwh)) mapa.set(k, c.kwh);
  }
  if (!periodo.length) return [...mapa.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([competencia, kwh]) => ({ competencia, kwh }));
  return periodo.map((competencia) => ({ competencia, kwh: mapa.has(competencia) ? mapa.get(competencia)! : null }));
}

export interface ResumoConsumo {
  total: number;
  /** Média mensal das competências informadas. */
  media: number;
  informados: number;
  faltando: number;
  linhas: LinhaConsumo[];
}

export function resumoConsumo(u: Pick<Usina, "periodoInicio" | "periodoFim" | "meses" | "consumoMensal">): ResumoConsumo {
  const linhas = consumoPorCompetencia(u);
  const com = linhas.filter((l) => l.kwh != null);
  const total = com.reduce((a, l) => a + (l.kwh ?? 0), 0);
  return { total, media: com.length ? total / com.length : 0, informados: com.length, faltando: linhas.length - com.length, linhas };
}

/** Grava o consumo de uma competência (null apaga), no formato AAAA-MM. Meses fora do período ficam guardados. */
export function definirConsumo(u: Pick<Usina, "periodoInicio" | "periodoFim" | "meses" | "consumoMensal">, competencia: string, kwh: number | null): ConsumoMes[] {
  const periodo = competencias(u);
  const mapa = new Map<string, number>();
  for (const c of u.consumoMensal ?? []) mapa.set(competenciaDoRotulo(c.mes, periodo) ?? c.mes, c.kwh);
  if (kwh == null) mapa.delete(competencia);
  else mapa.set(competencia, kwh);
  return [...mapa.entries()].sort(([x], [y]) => x.localeCompare(y)).map(([mes, v]) => ({ mes, kwh: v }));
}

/** Números colados de uma coluna/linha do Excel ("1.234,5\n2.000" etc.). */
export function numerosColados(texto: string): number[] {
  return texto
    .split(/[\t\r\n;]+/)
    .map((s) => s.trim())
    .filter((s) => /\d/.test(s))
    .map((s) => toNumber(s));
}
