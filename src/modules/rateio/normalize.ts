import type { Ligacao } from "./types";

/** Texto sem acentos, minúsculo, com espaços simples. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[º°]/g, "o")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chave da UC: só dígitos, sem zeros à esquerda. "2.645.915.011-27" e "264591501127" viram a mesma chave. */
export function ucKey(raw: unknown): string {
  const digits = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  return digits;
}

/** Converte números em formato brasileiro ou internacional. */
export function toNumber(v: unknown): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v == null) return 0;
  let s = String(v).trim().replace(/\s/g, "").replace(/kwh|r\$|%/gi, "");
  if (!s) return 0;
  const hasComma = s.includes(",");
  const hasDot = s.includes(".");
  if (hasComma && hasDot) {
    // o separador decimal é o que aparece por último
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (hasComma) {
    s = s.replace(",", ".");
  } else if (hasDot && /^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseLigacao(raw: unknown): Ligacao | null {
  const s = norm(raw).replace(/[^a-z]/g, "");
  if (s.startsWith("mono")) return "mono";
  if (s.startsWith("bi")) return "bi";
  if (s.startsWith("tri")) return "tri";
  return null;
}

/** Custo de disponibilidade do grupo B (kWh/mês). */
export const CONSUMO_MINIMO: Record<Ligacao, number> = { mono: 30, bi: 50, tri: 100 };

export const LIGACAO_LABEL: Record<Ligacao, string> = { mono: "Monofásico", bi: "Bifásico", tri: "Trifásico" };

export function round(n: number, d = 2): number {
  const f = 10 ** d;
  return Math.round(n * f) / f;
}
