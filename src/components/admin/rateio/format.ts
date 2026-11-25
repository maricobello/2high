export const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export const kwh = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : Math.round(n).toLocaleString("pt-BR"));

export const num = (n: number | null | undefined, d = 1) =>
  n == null || !Number.isFinite(n) ? "—" : n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });

export const pct = (n: number | null | undefined, d = 2) => (n == null || !Number.isFinite(n) ? "—" : `${n.toLocaleString("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d })}%`);

export const ratio = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%`);

/** Escala compacta: 1,2 mi · 340 mil. */
export function compacto(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} mi`;
  if (a >= 1e3) return `${(n / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return Math.round(n).toLocaleString("pt-BR");
}

/** Fração como percentual com 2 casas (para comparar soluções muito próximas). */
export const pct1 = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? "—" : `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}%`);
