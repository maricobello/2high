/**
 * Aplicação automática das fontes da usina (fatura e tela do Orange) no estudo,
 * quando a nota de confiança da leitura é alta o bastante.
 */
import { lerDemanda } from "./demanda";
import { aplicacaoDaFatura, scoreFatura } from "./fatura";
import { inferirMeses, scorePainel } from "./painel";
import type { Usina } from "./types";

/** Nota mínima para aplicar sem pedir confirmação. */
export const NOTA_AUTOMATICA = 70;

export function autoAplicar(u: Usina): Usina {
  let out = { ...u };
  const p = out.painel ?? null;
  const f = out.fatura ?? null;

  // meses do período da tela: descobertos pela fatura quando não informados
  if (p && p.meses == null) {
    const inf = inferirMeses(p.valores.injetada, f?.injetada);
    if (inf) out = { ...out, painel: { ...p, meses: inf.meses, mesesInferidos: true } };
  }
  const painel = out.painel ?? null;

  if (painel && painel.meses && out.fontePeriodo !== "manual") {
    const s = scorePainel(painel, f?.injetada);
    if (s.score >= NOTA_AUTOMATICA) {
      out = {
        ...out,
        meses: painel.meses,
        energiaContratadaPeriodo: painel.valores.estimada ?? out.energiaContratadaPeriodo,
        energiaGeradaPeriodo: painel.valores.geracaoRealizada ?? out.energiaGeradaPeriodo,
        energiaInjetadaPeriodo: painel.valores.injetada ?? out.energiaInjetadaPeriodo,
        fontePeriodo: "painel",
      };
    }
  }

  if (f && out.fonteInjecao !== "manual") {
    const s = scoreFatura(f, painel?.valores.injetada && painel.meses ? { kwh: painel.valores.injetada, meses: painel.meses } : null);
    const a = aplicacaoDaFatura(f);
    // fatura com só 1 ou 2 meses não substitui a média de um período maior da tela do Orange
    const poucoHistorico = a.mesesUsados.length < 3 && out.fontePeriodo === "painel" && (painel?.meses ?? 0) >= 3;
    if (poucoHistorico) {
      if (out.fonteInjecao === "fatura") out = { ...out, injecaoMensalProjetada: null, fonteInjecao: null };
      out = { ...out, distribuidora: out.distribuidora || f.distribuidora };
    } else if (s.score >= NOTA_AUTOMATICA && a.injecaoMensal) {
      out = {
        ...out,
        injecaoMensalProjetada: Math.round(a.injecaoMensal),
        perfilSazonal: a.perfilSazonal.length === 12 ? a.perfilSazonal : out.perfilSazonal,
        distribuidora: out.distribuidora || f.distribuidora,
        fonteInjecao: "fatura",
      };
    }
  }
  // demanda da fatura (não sobrescreve o que foi digitado)
  // faturas salvas antes da leitura de demanda: relê do texto guardado
  const d = f?.demanda ?? (f?.linhas ? lerDemanda(f.linhas) : null);
  if (d && out.demanda?.fonte !== "manual" && (d.contratadaKw != null || d.registradaKw != null)) {
    out = { ...out, demanda: { contratadaKw: d.contratadaKw, registradaKw: d.registradaKw, ultrapassagemKw: d.ultrapassagemKw, despesaUltrapassagem: d.despesaUltrapassagem, fonte: "fatura" } };
  }
  return out;
}
