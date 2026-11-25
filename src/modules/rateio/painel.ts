/**
 * Bloco "Energia" da tela de gestão de usinas do Orange (totais do período selecionado).
 * Entrada: texto copiado da tela ("Injetada 3.239.006") ou leitura da imagem do recorte.
 */
import { z } from "zod";
import { norm, toNumber } from "./normalize";

export const CAMPOS_PAINEL = {
  estimada: "Estimada",
  injetada: "Injetada",
  compensada: "Compensada",
  saldoInicial: "Saldo Inicial",
  saldoUtilizado: "Saldo Utilizado",
  saldoVencido: "Saldo Vencido",
  saldoAdicionado: "Saldo Adicionado",
  saldoAcumulado: "Saldo Acumulado",
  geracaoRealizada: "Geração Realizada",
  consumoUsina: "Consumo da Usina",
  divergencia: "Divergência de Faturamento",
  balancoInjetada: "Balanço Energia Injetada",
} as const;

export type CampoPainel = keyof typeof CAMPOS_PAINEL;
export type ValoresPainel = Partial<Record<CampoPainel, number>>;

export interface PainelOrange {
  valores: ValoresPainel;
  /** Meses do período selecionado na tela do Orange (o painel não mostra). */
  meses: number | null;
  /** true quando os meses foram descobertos cruzando com a fatura. */
  mesesInferidos?: boolean;
  fonte: "texto" | "imagem";
  lidoEm: string;
}

export const painelIaSchema = z.object(Object.fromEntries(Object.keys(CAMPOS_PAINEL).map((k) => [k, z.number().nullable().optional()])) as Record<CampoPainel, z.ZodOptional<z.ZodNullable<z.ZodNumber>>>);

const ALIASES: [CampoPainel, RegExp][] = [
  ["estimada", /^(energia )?estimada/],
  ["injetada", /^(energia )?injetada/],
  ["compensada", /^(energia )?compensada/],
  ["saldoInicial", /^saldo inicial/],
  ["saldoUtilizado", /^saldo utilizado/],
  ["saldoVencido", /^saldo vencido/],
  ["saldoAdicionado", /^saldo adicionado/],
  ["saldoAcumulado", /^saldo acumulado/],
  ["geracaoRealizada", /^geracao( realizada)?/],
  ["consumoUsina", /^consumo( da usina)?/],
  ["divergencia", /^divergencia/],
  ["balancoInjetada", /^balanco/],
];

/** Lê pares "rótulo valor" (um por linha, ou rótulo numa linha e valor na seguinte). */
export function lerPainelTexto(txt: string): ValoresPainel {
  const linhas = txt.replace(/\r/g, "").split("\n").map((l) => l.trim()).filter(Boolean);
  const out: ValoresPainel = {};
  for (let i = 0; i < linhas.length; i++) {
    const n = norm(linhas[i]);
    const campo = ALIASES.find(([, re]) => re.test(n))?.[0];
    if (!campo || out[campo] != null) continue;
    let m = /(-?\d[\d.,]*)\s*(kwh)?\s*$/.exec(linhas[i]);
    if (!m && linhas[i + 1] && /^-?\d[\d.,]*$/.test(linhas[i + 1])) m = /(-?\d[\d.,]*)/.exec(linhas[i + 1]);
    if (!m) continue;
    // "-535.480,0": vírgula decimal com uma casa
    out[campo] = toNumber(m[1]);
  }
  return out;
}

export interface ChecagemPainel {
  ok: boolean;
  titulo: string;
  detalhe: string;
}

/** Conferências entre a tela do Orange, a lista de UCs e a fatura. */
export function checarPainel(p: ValoresPainel, ctx: { saldoUcs: number; compensadoUcsMes: number; meses: number | null; injecaoFaturaPeriodo: number | null }): ChecagemPainel[] {
  const c: ChecagemPainel[] = [];
  const fmt = (v: number) => Math.round(v).toLocaleString("pt-BR");
  if (p.saldoInicial != null && p.saldoUtilizado != null && p.saldoAdicionado != null && p.saldoAcumulado != null) {
    const calc = p.saldoInicial - p.saldoUtilizado - (p.saldoVencido ?? 0) + p.saldoAdicionado;
    const ok = Math.abs(calc - p.saldoAcumulado) <= Math.max(2, p.saldoAcumulado * 0.001);
    c.push({ ok, titulo: "Saldo fecha (inicial − utilizado − vencido + adicionado = acumulado)", detalhe: `${fmt(calc)} calculado; ${fmt(p.saldoAcumulado)} na tela.` });
  }
  if (p.saldoAcumulado != null && ctx.saldoUcs > 0) {
    const dif = (ctx.saldoUcs - p.saldoAcumulado) / p.saldoAcumulado;
    c.push({ ok: Math.abs(dif) <= 0.02, titulo: "Saldo acumulado bate com a soma das UCs", detalhe: `Tela: ${fmt(p.saldoAcumulado)} kWh; lista de UCs: ${fmt(ctx.saldoUcs)} kWh (${(dif * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%).` });
  }
  if (p.injetada != null && p.compensada != null && p.injetada > 0) {
    c.push({ ok: p.compensada <= p.injetada * 1.001 + (p.saldoUtilizado ?? 0), titulo: "Compensada não passa da injetada mais o saldo usado", detalhe: `Compensada ${fmt(p.compensada)}; injetada ${fmt(p.injetada)} (${((p.compensada / p.injetada) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%).` });
  }
  if (p.injetada != null && ctx.injecaoFaturaPeriodo != null && ctx.injecaoFaturaPeriodo > 0) {
    const dif = (p.injetada - ctx.injecaoFaturaPeriodo) / ctx.injecaoFaturaPeriodo;
    c.push({ ok: Math.abs(dif) <= 0.03, titulo: "Injetada na tela bate com a fatura", detalhe: `Tela: ${fmt(p.injetada)} kWh; fatura (mesmos meses): ${fmt(ctx.injecaoFaturaPeriodo)} kWh (${(dif * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%).` });
  }
  if (p.geracaoRealizada != null && p.injetada != null && p.injetada > p.geracaoRealizada * 1.02)
    c.push({ ok: false, titulo: "Injetada maior que a geração realizada", detalhe: `Injetada ${fmt(p.injetada)}; geração ${fmt(p.geracaoRealizada)}.` });
  if (p.divergencia != null && p.injetada != null && p.injetada > 0)
    c.push({ ok: Math.abs(p.divergencia) <= p.injetada * 0.05, titulo: "Divergência de faturamento até 5% da injetada", detalhe: `${fmt(p.divergencia)} kWh (${((p.divergencia / p.injetada) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da injetada).` });
  if (p.saldoVencido != null && p.saldoVencido > 0) c.push({ ok: false, titulo: "Há saldo vencido", detalhe: `${fmt(p.saldoVencido)} kWh venceram no período.` });
  return c;
}

/**
 * Meses do período da tela do Orange: o número de meses (a partir do mais recente com
 * injeção na fatura) cuja soma mais se aproxima da "Injetada" da tela.
 */
export function inferirMeses(injetadaTela: number | undefined, injetadaFatura: Record<string, number> | undefined): { meses: number; diferenca: number } | null {
  if (!injetadaTela || !injetadaFatura) return null;
  const serie = Object.entries(injetadaFatura)
    .filter(([, v]) => v > 0)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([, v]) => v);
  let melhor: { meses: number; diferenca: number } | null = null;
  let soma = 0;
  serie.forEach((v, i) => {
    soma += v;
    const dif = Math.abs(soma - injetadaTela) / injetadaTela;
    if (!melhor || dif < melhor.diferenca) melhor = { meses: i + 1, diferenca: dif };
  });
  return melhor && (melhor as { diferenca: number }).diferenca <= 0.05 ? melhor : null;
}

export interface ScorePainel {
  score: number;
  nivel: "alta" | "media" | "baixa";
  itens: { ok: boolean; texto: string; pontos: number; max: number }[];
}

/** Nota de 0 a 100 da leitura da tela: campos lidos e se os números fecham entre si e com a fatura. */
export function scorePainel(p: PainelOrange, injetadaFatura?: Record<string, number>): ScorePainel {
  const itens: ScorePainel["itens"] = [];
  const add = (ok: boolean, texto: string, max: number, pontos = ok ? max : 0) => itens.push({ ok, texto, pontos, max });
  const v = p.valores;
  const lidos = (Object.keys(CAMPOS_PAINEL) as CampoPainel[]).filter((k) => typeof v[k] === "number").length;
  add(lidos >= 10, `${lidos} de 12 campos lidos`, 25, Math.round((lidos / 12) * 25));
  const temSaldo = v.saldoInicial != null && v.saldoUtilizado != null && v.saldoAdicionado != null && v.saldoAcumulado != null;
  if (temSaldo) {
    const calc = v.saldoInicial! - v.saldoUtilizado! - (v.saldoVencido ?? 0) + v.saldoAdicionado!;
    const ok = Math.abs(calc - v.saldoAcumulado!) <= Math.max(2, v.saldoAcumulado! * 0.001);
    add(ok, ok ? "Saldo fecha (inicial − utilizado − vencido + adicionado = acumulado)" : "Saldo não fecha: algum dígito pode ter sido lido errado", 30);
  } else add(false, "Sem os quatro saldos para conferir", 30, 5);
  const coer = v.injetada != null && v.geracaoRealizada != null && v.compensada != null ? v.injetada <= v.geracaoRealizada * 1.02 && v.compensada <= v.injetada * 1.001 + (v.saldoUtilizado ?? 0) : null;
  add(coer === true, coer == null ? "Faltam geração, injetada ou compensada" : coer ? "Geração ≥ injetada ≥ compensada" : "Ordem geração ≥ injetada ≥ compensada não fecha", 15, coer == null ? 5 : coer ? 15 : 0);
  const inf = inferirMeses(v.injetada, injetadaFatura);
  if (injetadaFatura && Object.keys(injetadaFatura).length) {
    add(!!inf, inf ? `Injetada bate com ${inf.meses} meses da fatura (${(inf.diferenca * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)` : "Injetada não bate com nenhum período da fatura", 30, inf ? (inf.diferenca <= 0.01 ? 30 : 22) : 0);
  } else add(false, "Sem a fatura para conferir a injetada", 30, 12);
  const max = itens.reduce((a, i) => a + i.max, 0);
  let score = Math.round((itens.reduce((a, i) => a + i.pontos, 0) / max) * 100);
  // travas: saldo que não fecha ou injetada que não bate com a fatura indicam dígito lido errado
  const saldoFalhou = temSaldo && !itens[1].ok;
  const faturaFalhou = !!injetadaFatura && Object.keys(injetadaFatura).length > 0 && !inf;
  if (saldoFalhou) score = Math.min(score, 55);
  if (faturaFalhou) score = Math.min(score, 65);
  return { score, nivel: score >= 80 ? "alta" : score >= 60 ? "media" : "baixa", itens };
}
