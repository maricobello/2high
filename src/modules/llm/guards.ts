/**
 * Guardas determinísticas aplicadas a TODO texto gerado por IA.
 * - A IA não pode introduzir números que não estejam nos dados de entrada.
 * - A IA não pode usar linguagem absoluta/proibida.
 * Se reprovar, o sistema usa o texto padrão (template).
 */

const FORBIDDEN = [
  /roubad/i,
  /garant(imos|ido|ia de)\s+(\d|economia|redu)/i,
  /cobrando\s+errado/i,
  /dinheiro\s+(para|a)\s+receber/i,
  /com\s+certeza/i,
  /sem\s+d[uú]vida/i,
  /eleg[ií]vel\b(?!\s*\?)/i,
  /\b(fraude|golpe)\b/i,
  /economia\s+garantida/i,
];

/** Extrai números do texto e normaliza para comparação (ex.: "R$ 1.234,56" -> 1234.56). */
export function extractNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?|\d+\.\d+/g;
  for (const m of text.match(re) ?? []) {
    let s = m;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
    const n = Number(s);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

export function collectAllowedNumbers(value: unknown, acc: Set<number> = new Set()): Set<number> {
  if (typeof value === "number" && Number.isFinite(value)) {
    acc.add(value);
    acc.add(Math.round(value));
    acc.add(Math.round(value * 100) / 100);
  } else if (typeof value === "string") {
    for (const n of extractNumbers(value)) acc.add(n);
  } else if (Array.isArray(value)) {
    for (const v of value) collectAllowedNumbers(v, acc);
  } else if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectAllowedNumbers(v, acc);
  }
  return acc;
}

export interface GuardResult {
  ok: boolean;
  reasons: string[];
}

export function guardGeneratedText(text: string, allowed: Set<number>): GuardResult {
  const reasons: string[] = [];
  if (!text || text.trim().length < 10) reasons.push("texto vazio");
  for (const re of FORBIDDEN) if (re.test(text)) reasons.push(`linguagem proibida: ${re}`);

  const allowedList = [...allowed];
  for (const n of extractNumbers(text)) {
    if (n <= 12 && Number.isInteger(n)) continue; // contagens pequenas, meses, passos
    if (n >= 2000 && n <= 2100 && Number.isInteger(n)) continue; // anos
    const ok = allowedList.some((a) => Math.abs(a - n) <= Math.max(0.01, Math.abs(a) * 0.005));
    if (!ok) reasons.push(`número não fornecido: ${n}`);
  }
  return { ok: reasons.length === 0, reasons };
}
