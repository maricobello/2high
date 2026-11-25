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
