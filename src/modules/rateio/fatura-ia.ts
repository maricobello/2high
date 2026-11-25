/**
 * Leitura da fatura pela IA, com travas: só vale número que aparece de fato no texto da
 * fatura; a IA completa o que as regras não acharam e confere o que elas acharam.
 */
import { z } from "zod";
import type { Demanda } from "./demanda";
import type { FaturaUsina } from "./fatura";
import { apareceNoTexto, numerosDoTexto, type CampoLayout } from "./layout";
import { toNumber } from "./normalize";

const num = z.union([z.number(), z.string()]).transform((v) => (typeof v === "number" ? v : toNumber(v)));
const comps = z.array(num).nullish();

/** Resposta da IA: cada valor em componentes, exatamente como aparecem na fatura (ex.: ponta e fora ponta). */
export const faturaIaSchema = z.object({
  distribuidora: z.string().nullish(),
  mesReferencia: z.string().nullish(),
  injetada: comps,
  consumoUsina: comps,
  excedente: comps,
  saldo: comps,
  demandaContratada: comps,
  demandaRegistrada: comps,
  ultrapassagemKw: comps,
  despesaUltrapassagem: comps,
  historico: z
    .array(z.object({ mes: z.string(), injetada: comps, consumo: comps, excedente: comps }))
    .nullish(),
});
export type FaturaIa = z.infer<typeof faturaIaSchema>;

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

