/**
 * Leitura da fatura pela IA, com travas: só vale número que aparece de fato no texto da
 * fatura; a IA completa o que as regras não acharam e confere o que elas acharam.
 */
import { z } from "zod";
import type { Demanda } from "./demanda";
import type { FaturaUsina } from "./fatura";
import { apareceNoTexto, numerosDoTexto, type CampoLayout } from "./layout";
import { toNumber } from "./normalize";

/** Valor da IA em qualquer forma comum → lista de números (partes como aparecem na fatura). */
function partes(v: unknown): number[] | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? [v] : null;
  if (typeof v === "string") {
    const n = toNumber(v);
    return /\d/.test(v) && Number.isFinite(n) ? [n] : null;
  }
  if (Array.isArray(v)) {
    const out = v.flatMap((x) => partes(x) ?? []);
    return out.length ? out : null;
  }
  if (typeof v === "object") {
    // {ponta: x, foraPonta: y}, {valor: x}, {total: x}…
    const o = v as Record<string, unknown>;
    const vals = Object.entries(o)
      .filter(([k]) => !/total/i.test(k) || Object.keys(o).length === 1)
      .flatMap(([, x]) => partes(x) ?? []);
    return vals.length ? vals : null;
  }
  return null;
}

/** "2026-09", "09/2026", "SET/26", "set/2026" → "2026-09". */
function mesIa(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[/.-](\d{4})$/.exec(t);
  if (m) return `${m[2]}-${m[1].padStart(2, "0")}`;
  const n = /^([a-zç]{3})[a-zç]*[/.\-\s]?(\d{2}|\d{4})$/i.exec(t);
  const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  if (n) {
    const i = meses.indexOf(n[1].toLowerCase().slice(0, 3));
    if (i >= 0) return `${n[2].length === 2 ? 2000 + Number(n[2]) : n[2]}-${String(i + 1).padStart(2, "0")}`;
  }
  return null;
}

const comps = z.unknown().optional().transform((v) => partes(v));
const mesCampo = z.unknown().optional().transform((v) => mesIa(v));

/**
 * Resposta da IA, tolerante à forma: número, texto "124.580", lista de partes, objeto por
 * posto ({ponta, foraPonta}), resposta embrulhada ({"fatura": {...}}), mês em vários formatos.
 * A trava de verdade vem depois: só vale número que aparece na fatura.
 */
export const faturaIaSchema = z.preprocess(
  (raw) => {
    let o = raw;
    // {"fatura": {...}} / {"dados": {...}}
    if (o && typeof o === "object" && !Array.isArray(o)) {
      const vals = Object.values(o as Record<string, unknown>);
      const temCampo = Object.keys(o as Record<string, unknown>).some((k) => /injet|mes|distrib|saldo|demanda|hist/i.test(k));
      if (!temCampo && vals.length === 1 && vals[0] && typeof vals[0] === "object") o = vals[0];
    }
    return o && typeof o === "object" ? o : {};
  },
  z.object({
    distribuidora: z.unknown().optional().transform((v) => (typeof v === "string" ? v : null)),
    mesReferencia: mesCampo,
    injetada: comps,
    consumoUsina: comps,
    excedente: comps,
    saldo: comps,
    demandaContratada: comps,
    demandaRegistrada: comps,
    ultrapassagemKw: comps,
    despesaUltrapassagem: comps,
    historico: z
      .unknown()
      .optional()
      .transform((v) =>
        (Array.isArray(v) ? v : [])
          .map((h) => (h && typeof h === "object" ? (h as Record<string, unknown>) : null))
          .filter((h): h is Record<string, unknown> => !!h)
          .map((h) => ({ mes: mesIa(h.mes ?? h.mesReferencia ?? h.referencia) ?? "", injetada: partes(h.injetada), consumo: partes(h.consumo ?? h.consumoUsina), excedente: partes(h.excedente) })),
      ),
  }),
);
export type FaturaIa = Partial<z.infer<typeof faturaIaSchema>>;

const CAMPOS: CampoLayout[] = ["injetada", "consumoUsina", "excedente", "saldo", "demandaContratada", "demandaRegistrada", "ultrapassagemKw", "despesaUltrapassagem"];

export interface LeituraIaValidada {
  distribuidora: string | null;
  mesReferencia: string | null;
  /** Componentes aceitos por campo (todos aparecem no texto). */
  componentes: Partial<Record<CampoLayout, number[]>>;
  historico: { mes: string; injetada: number | null; consumo: number | null; excedente: number | null }[];
  descartados: string[];
}

/** Tira o que a IA devolveu e não está no texto da fatura (trava contra número inventado). */
export function validarIa(ia: FaturaIa, linhas: string[]): LeituraIaValidada {
  const nums = numerosDoTexto(linhas);
  const descartados: string[] = [];
  const componentes: LeituraIaValidada["componentes"] = {};
  for (const c of CAMPOS) {
    const v = ia[c];
    if (!v?.length) continue;
    if (v.every((x) => Number.isFinite(x) && apareceNoTexto(x, nums))) componentes[c] = v;
    else descartados.push(c);
  }
  const soma = (a: number[] | null | undefined) => (a?.length && a.every((x) => apareceNoTexto(x, nums)) ? a.reduce((s, x) => s + x, 0) : null);
  const historico = (ia.historico ?? [])
    .filter((h) => /^\d{4}-\d{2}$/.test(h.mes))
    .map((h) => ({ mes: h.mes, injetada: soma(h.injetada), consumo: soma(h.consumo), excedente: soma(h.excedente) }));
  const mes = ia.mesReferencia && /^\d{4}-(0[1-9]|1[0-2])$/.test(ia.mesReferencia) ? ia.mesReferencia : null;
  return { distribuidora: ia.distribuidora?.trim() || null, mesReferencia: mes, componentes, historico, descartados };
}

const total = (v: number[] | undefined) => (v?.length ? v.reduce((a, b) => a + b, 0) : null);

/**
 * Junta a leitura da IA na fatura lida pelas regras: completa o que faltou e marca se as
 * duas leituras da injetada concordam (conferência independente).
 */
export function mesclarIa(f: FaturaUsina, ia: LeituraIaValidada): FaturaUsina {
  const out: FaturaUsina = { ...f, injetada: { ...f.injetada }, consumo: { ...f.consumo }, excedente: { ...f.excedente }, avisos: [...f.avisos], camposIa: [] };
  if (!out.distribuidora && ia.distribuidora) out.distribuidora = ia.distribuidora.toUpperCase();
  if (!out.mesReferencia && ia.mesReferencia) out.mesReferencia = ia.mesReferencia;
  const ref = out.mesReferencia;
  const c = ia.componentes;

  // injetada do mês: completa ou confere
  const injIa = total(c.injetada);
  if (ref && injIa != null && injIa > 0) {
    const regra = out.injetada[ref];
    if (regra == null || regra <= 0) {
      out.injetada[ref] = injIa;
      out.camposIa!.push("injetada");
    } else {
      const dif = Math.abs(regra - injIa) / regra;
      out.conferenciaIa = dif <= 0.01 ? "ok" : "divergente";
      if (dif > 0.01) out.avisos.push(`A IA leu ${Math.round(injIa).toLocaleString("pt-BR")} kWh de injetada e as regras ${Math.round(regra).toLocaleString("pt-BR")} kWh: confira.`);
    }
  }
  const completa = (serie: "consumo" | "excedente", v: number | null, nome: string) => {
    if (ref && v != null && out[serie][ref] == null) {
      out[serie][ref] = v;
      out.camposIa!.push(nome);
    }
  };
  completa("consumo", total(c.consumoUsina), "consumoUsina");
  completa("excedente", total(c.excedente), "excedente");
  if (out.saldoKwh == null && total(c.saldo) != null) {
    out.saldoKwh = total(c.saldo);
    out.camposIa!.push("saldo");
  }
  // histórico: só meses que faltam
  for (const h of ia.historico) {
    if (h.injetada != null && out.injetada[h.mes] == null) out.injetada[h.mes] = h.injetada;
    if (h.consumo != null && out.consumo[h.mes] == null) out.consumo[h.mes] = h.consumo;
    if (h.excedente != null && out.excedente[h.mes] == null) out.excedente[h.mes] = h.excedente;
  }
  // demanda: completa campos vazios
  const dIa = {
    contratadaKw: total(c.demandaContratada),
    registradaKw: c.demandaRegistrada?.length ? Math.max(...c.demandaRegistrada) : null,
    ultrapassagemKw: total(c.ultrapassagemKw),
    despesaUltrapassagem: total(c.despesaUltrapassagem),
  };
  if (Object.values(dIa).some((v) => v != null)) {
    const d: Demanda = out.demanda ? { ...out.demanda } : { contratadaKw: null, contratadaConsumoKw: null, registradaKw: null, registradaConsumoKw: null, ultrapassagemKw: null, despesaUltrapassagem: null, itens: [] };
    for (const k of ["contratadaKw", "registradaKw", "ultrapassagemKw", "despesaUltrapassagem"] as const) {
      if (d[k] == null && dIa[k] != null) {
        d[k] = dIa[k];
        out.camposIa!.push(k);
      }
    }
    out.demanda = d;
  }
  if (ia.descartados.length) out.avisos.push(`Valores da IA descartados por não aparecerem na fatura: ${ia.descartados.join(", ")}.`);
  const faltas = out.avisos.filter((a) => !/^Não encontrei a energia injetada/.test(a) || !Object.keys(out.injetada).length);
  out.avisos = faltas;
  out.leituraIa = true;
  return out;
}

/** Componentes de cada campo a partir da fatura final (para aprender o layout). */
export function componentesParaAprender(ia: LeituraIaValidada): Partial<Record<CampoLayout, number[]>> {
  return ia.componentes;
}

/** Tira do texto o que identifica o cliente antes de mandar para a IA (documentos, chaves, endereço). */
export function anonimizarFatura(linhas: string[]): string[] {
  return linhas
    .filter((l) => !/(cep[:\s]|endere[cç]o|cnpj|cpf|chave de acesso|protocolo|c[oó]digo de barras|nosso n[uú]mero|ag[eê]ncia|benefici[aá]rio|pagador)/i.test(l))
    .map((l) =>
      l
        .replace(/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, "[doc]") // CNPJ
        .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "[doc]") // CPF
        .replace(/\b\d{1,3}(?:\.\d{3}){2,}-\d{1,2}\b/g, "[uc]") // número de instalação com dígito
        .replace(/\b\d{20,}\b/g, "[cod]") // chaves e códigos longos
        .replace(/(?:\d{4,}[\s.]){3,}\d{4,}/g, "[cod]") // linha digitável
        .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[email]")
        .replace(/\(?\d{2}\)?\s?\d{4,5}-\d{4}/g, "[tel]"),
    )
    .slice(0, 400);
}

