/**
 * Layouts aprendidos de fatura, por distribuidora.
 *
 * Quando a IA lê uma fatura nova, o sistema procura no texto onde está cada número que ela
 * achou e guarda o rótulo que vem antes dele (ex.: "kwh injetado fponta"). Na próxima
 * fatura da mesma distribuidora, esses rótulos leem os valores sem IA. Só rótulos ficam
 * guardados: nenhum número, nome, endereço ou instalação do cliente.
 */
import { norm, toNumber } from "./normalize";

/** Campos do mês de referência que o layout aprende. Cada um pode ter mais de um componente (ponta, fora ponta). */
export const CAMPOS_LAYOUT = {
  injetada: "Energia injetada no mês",
  consumoUsina: "Consumo da própria usina no mês",
  excedente: "Excedente distribuído no mês",
  saldo: "Saldo de créditos da usina",
  demandaContratada: "Demanda contratada",
  demandaRegistrada: "Demanda registrada",
  ultrapassagemKw: "Ultrapassagem de demanda",
  despesaUltrapassagem: "Despesa com ultrapassagem",
} as const;
export type CampoLayout = keyof typeof CAMPOS_LAYOUT;

export interface LayoutFatura {
  distribuidora: string;
  /** Rótulos aprendidos por campo; cada rótulo é um componente somado (ex.: ponta + fora ponta). */
  campos: Partial<Record<CampoLayout, string[][]>>;
  /** Leituras feitas com este layout e quantas precisaram de IA. */
  leituras: number;
  leiturasIa: number;
  atualizadoEm: string;
}

// números BR ("124.580", "35.220,0000", "2,45") e negativos com sinal no fim
const NUM_RE = /-?\d{1,3}(?:\.\d{3})+(?:,\d+)?-?|-?\d+,\d+-?|-?\d+-?/g;

function numerosComPosicao(linha: string): { v: number; ini: number; fim: number }[] {
  return [...linha.matchAll(NUM_RE)].map((m) => {
    const s = m[0];
    const v = s.endsWith("-") ? -toNumber(s.slice(0, -1)) : toNumber(s);
    return { v, ini: m.index!, fim: m.index! + s.length };
  });
}

/** Todos os números que aparecem no texto (para conferir que a IA não inventou nada). */
export function numerosDoTexto(linhas: string[]): number[] {
  return linhas.flatMap((l) => numerosComPosicao(l).map((n) => n.v));
}

export function apareceNoTexto(v: number, numeros: number[]): boolean {
  return numeros.some((n) => Math.abs(n - v) <= Math.max(0.01, Math.abs(v) * 1e-6));
}

/** Palavras de um trecho, normalizadas, sem números nem palavras de uma letra (mesma regra ao aprender e ao ler). */
function palavras(trecho: string): string[] {
  return norm(trecho)
    .replace(/[\d.,]+/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

/** Rótulo antes de uma posição da linha: até 4 palavras. */
function rotuloAntes(linha: string, pos: number): string {
  return palavras(linha.slice(0, pos)).slice(-4).join(" ");
}

/** Palavras que indicam cada campo (preferência quando o mesmo número aparece em vários lugares). */
const DICAS: Record<CampoLayout, RegExp> = {
  injetada: /inj/,
  consumoUsina: /consum/,
  excedente: /exced|distribu|alocad/,
  saldo: /saldo|credit/,
  demandaContratada: /demanda|contrat|gera/,
  demandaRegistrada: /demanda|medid|regist|gera/,
  ultrapassagemKw: /ultrapass/,
  despesaUltrapassagem: /ultrapass/,
};

/** Procura um número igual a `v` e devolve o rótulo que vem antes dele (linhas com a dica do campo primeiro). */
function aprenderRotulo(linhas: string[], v: number, dica: RegExp): string | null {
  const achados: string[] = [];
  for (const l of linhas) {
    for (const n of numerosComPosicao(l)) {
      if (Math.abs(n.v - v) > Math.max(0.01, Math.abs(v) * 1e-6)) continue;
      const r = rotuloAntes(l, n.ini);
      if (r.split(" ").length >= 2) achados.push(r);
    }
  }
  return achados.find((r) => dica.test(r)) ?? null;
}

/** Lê um componente: o número logo depois do rótulo (o rótulo são as palavras imediatamente antes dele). */
function lerRotulo(linhas: string[], rotulo: string): number | null {
  for (const l of linhas) {
    if (!` ${palavras(l).join(" ")} `.includes(` ${rotulo} `)) continue;
    for (const n of numerosComPosicao(l)) if (rotuloAntes(l, n.ini) === rotulo) return n.v;
  }
  return null;
}

/** Valores do mês lidos com o layout aprendido. */
export function aplicarLayout(linhas: string[], layout: LayoutFatura | null | undefined): Partial<Record<CampoLayout, number>> {
  const out: Partial<Record<CampoLayout, number>> = {};
  if (!layout) return out;
  for (const [campo, componentes] of Object.entries(layout.campos) as [CampoLayout, string[][]][]) {
    // cada alternativa é uma lista de rótulos somados; vale a primeira que acha todos
    for (const alt of componentes) {
      const vals = alt.map((r) => lerRotulo(linhas, r));
      if (vals.every((v) => v != null)) {
        out[campo] = vals.reduce((a, b) => a! + b!, 0)!;
        break;
      }
    }
  }
  return out;
}

/**
 * Aprende com uma leitura (da IA, conferida): para cada campo, os rótulos dos componentes
 * (números como aparecem na fatura). Mantém até 3 alternativas por campo.
 */
export function aprenderLayout(atual: LayoutFatura | null, distribuidora: string, linhas: string[], componentes: Partial<Record<CampoLayout, number[]>>, usouIa: boolean): LayoutFatura {
  const l: LayoutFatura = atual ? { ...atual, campos: { ...atual.campos } } : { distribuidora, campos: {}, leituras: 0, leiturasIa: 0, atualizadoEm: "" };
  for (const [campo, nums] of Object.entries(componentes) as [CampoLayout, number[]][]) {
    if (!nums?.length || nums.some((v) => !Number.isFinite(v))) continue;
    const rotulos = nums.map((v) => aprenderRotulo(linhas, v, DICAS[campo]));
    if (rotulos.some((r) => !r)) continue;
    const alt = rotulos as string[];
    const existentes = l.campos[campo] ?? [];
    if (existentes.some((e) => e.join("|") === alt.join("|"))) continue;
    l.campos[campo] = [alt, ...existentes].slice(0, 3);
  }
  l.leituras += 1;
  if (usouIa) l.leiturasIa += 1;
  l.atualizadoEm = new Date().toISOString();
  return l;
}

/** Junta duas versões do mesmo layout (servidor × navegador). */
export function juntarLayouts(a: LayoutFatura, b: LayoutFatura): LayoutFatura {
  const campos: LayoutFatura["campos"] = { ...a.campos };
  for (const [k, alts] of Object.entries(b.campos) as [CampoLayout, string[][]][]) {
    const vistos = new Set((campos[k] ?? []).map((x) => x.join("|")));
    campos[k] = [...alts.filter((x) => !vistos.has(x.join("|"))), ...(campos[k] ?? [])].slice(0, 3);
  }
  return { distribuidora: a.distribuidora, campos, leituras: Math.max(a.leituras, b.leituras), leiturasIa: Math.max(a.leiturasIa, b.leiturasIa), atualizadoEm: a.atualizadoEm > b.atualizadoEm ? a.atualizadoEm : b.atualizadoEm };
}
