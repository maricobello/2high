/**
 * Distribuidora canônica: o crédito de GD só vale na mesma área de concessão. Os nomes variam
 * entre fatura, Orange e export ("NEOENERGIA" na fatura da Celpe, "ENEL-SP" × "ENEL SP",
 * "EQUATORIAL" sem estado). Grupo sem estado é resolvido pela UF (o Endereço ID começa por ela).
 */
import type { Candidata, Usina } from "./types";

const limpar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

const NOMES: [RegExp, string][] = [
  [/\b(CELPE|NEOENERGIA (PE|PERNAMBUCO))\b/, "CELPE"],
  [/\b(COELBA|NEOENERGIA (BA|BAHIA|COELBA))\b/, "COELBA"],
  [/\b(COSERN|NEOENERGIA (RN|COSERN))\b/, "COSERN"],
  [/\b(NEOENERGIA (DF|BRASILIA)|CEB)\b/, "CEB"],
  [/\b(ELETROPAULO|ENEL (SP|SAO PAULO))\b/, "ENEL SP"],
  [/\b(AMPLA|ENEL (RJ|RIO))\b/, "ENEL RJ"],
  [/\b(COELCE|ENEL (CE|CEARA))\b/, "ENEL CE"],
  [/\b(CELG|ENEL GO|EQUATORIAL (GO|GOIAS))\b/, "EQUATORIAL GO"],
  [/\b(CEAL|EQUATORIAL (AL|ALAGOAS))\b/, "EQUATORIAL AL"],
  [/\b(CELPA|EQUATORIAL (PA|PARA))\b/, "EQUATORIAL PA"],
  [/\b(CEMAR|EQUATORIAL (MA|MAR|MARANHAO))\b/, "EQUATORIAL MA"],
  [/\b(CEPISA|EQUATORIAL (PI|PIAUI))\b/, "EQUATORIAL PI"],
  [/\b(CEEE|EQUATORIAL RS)\b/, "CEEE"],
  [/\b(CEA|EQUATORIAL AP)\b/, "CEA"],
  [/\bRGE\b/, "RGE"],
  [/\bCPFL (PAULISTA|PIRATININGA|SANTA CRUZ)\b/, "CPFL $1"],
  [/\bEDP (SP|ES)\b/, "EDP $1"],
  [/\bENERGISA ([A-Z]{2,4})\b/, "ENERGISA $1"],
];

/** Grupo + UF → distribuidora (quando a fatura só traz o grupo). */
const POR_UF: Record<string, Record<string, string>> = {
  NEOENERGIA: { PE: "CELPE", BA: "COELBA", RN: "COSERN", DF: "CEB" },
  EQUATORIAL: { AL: "EQUATORIAL AL", GO: "EQUATORIAL GO", PA: "EQUATORIAL PA", MA: "EQUATORIAL MA", PI: "EQUATORIAL PI", RS: "CEEE", AP: "CEA" },
  ENEL: { SP: "ENEL SP", RJ: "ENEL RJ", CE: "ENEL CE" },
  ENERGISA: { MT: "ENERGISA MT", MS: "ENERGISA MS", TO: "ENERGISA TO", SE: "ENERGISA SE", PB: "ENERGISA PB", RO: "ENERGISA RO", AC: "ENERGISA ACRE" },
  EDP: { SP: "EDP SP", ES: "EDP ES" },
  CPFL: { RS: "RGE" },
};

export interface DistCanon {
  /** Distribuidora identificada; null quando só se sabe o grupo. */
  id: string | null;
  grupo: string | null;
}

export function canonDistribuidora(raw: string, uf?: string | null): DistCanon {
  const s = limpar(raw ?? "");
  if (!s) return { id: null, grupo: null };
  for (const [re, nome] of NOMES) {
    const m = re.exec(s);
    if (m) return { id: nome.replace("$1", m[1] ?? ""), grupo: nome.split(" ")[0] };
  }
  const grupo = Object.keys(POR_UF).find((g) => s === g || s.startsWith(`${g} `));
  if (grupo) {
    const id = uf ? POR_UF[grupo][uf] : undefined;
    return { id: id ?? null, grupo };
  }
  return { id: s, grupo: s.split(" ")[0] };
}

/** UF pelo início do apelido/Endereço ID ("PEGLR_0029" → PE). */
export function ufDoApelido(apelido: string): string | null {
  const m = /^([A-Z]{2})[A-Z0-9]{3}_/.exec((apelido ?? "").trim().toUpperCase());
  return m ? m[1] : null;
}

/** UF mais comum entre as UCs da usina. */
export function ufDaUsina(u: Pick<Usina, "ucs">): string | null {
  const cont = new Map<string, number>();
  for (const c of u.ucs) {
    const uf = ufDoApelido(c.apelido);
    if (uf) cont.set(uf, (cont.get(uf) ?? 0) + 1);
  }
  let melhor: string | null = null;
  for (const [uf, n] of cont) if (!melhor || n > (cont.get(melhor) ?? 0)) melhor = uf;
  return melhor;
}

/**
 * A candidata pode receber crédito desta usina? Mesma distribuidora; sem dado de um dos lados,
 * aceita (não dá para dizer que não). Só o grupo ("EQUATORIAL") sem UF: exige a mesma UF.
 */
export function mesmaDistribuidora(c: Pick<Candidata, "concessionaria" | "apelido">, u: Pick<Usina, "distribuidora" | "ucs">, ufUsina = ufDaUsina(u)): boolean {
  const ufC = ufDoApelido(c.apelido);
  const a = canonDistribuidora(c.concessionaria, ufC);
  const b = canonDistribuidora(u.distribuidora, ufUsina);
  if (!a.grupo || !b.grupo) return true;
  if (a.id && b.id) return a.id === b.id;
  if (a.grupo !== b.grupo) return false;
  return !ufC || !ufUsina || ufC === ufUsina;
}
