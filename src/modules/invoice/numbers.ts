/**
 * Conversão determinística de números no formato brasileiro.
 * "1.234,56" -> 1234.56 | "1.234" -> 1234 | "0,85" -> 0.85 | "12.5" -> 12.5
 */
export function parseBrNumber(raw: string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null;
  let s = String(raw).trim().replace(/\s/g, "").replace(/^R\$/i, "");
  if (!s) return null;
  const negative = /^-/.test(s) || /-$/.test(s);
  s = s.replace(/^-|-$/g, "");
  if (!/^[\d.,]+$/.test(s)) return null;

  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/**
 * Variações textuais de um número, para conferir se um valor extraído pela IA
 * realmente aparece no texto do documento (proteção contra alucinação).
 */
export function numberTextVariants(n: number): string[] {
  const variants = new Set<string>();
  const abs = Math.abs(n);
  const decimalsList = Number.isInteger(abs) ? [0, 1, 2] : [1, 2, 3, 4, 5, 6];
  for (const d of decimalsList) {
    const fixed = abs.toFixed(d);
    const [int, dec] = fixed.split(".");
    const intThousands = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    if (dec === undefined) {
      variants.add(int);
      variants.add(intThousands);
    } else {
      variants.add(`${int},${dec}`);
      variants.add(`${intThousands},${dec}`);
      variants.add(`${int}.${dec}`);
    }
  }
  return [...variants];
}

/** Normaliza texto para busca: remove quebras redundantes e espaços múltiplos. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ {2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n");
}

export function textContainsNumber(text: string, n: number): boolean {
  const compact = text.replace(/\s+/g, "");
  return numberTextVariants(n).some((v) => {
    const escaped = v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\d])${escaped}($|[^\\d])`).test(compact) || new RegExp(`(^|[^\\d.,])${escaped}($|[^\\d])`).test(text);
  });
}
