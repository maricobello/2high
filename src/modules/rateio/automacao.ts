/**
 * Aplicação automática das fontes da usina (fatura e tela do Orange) no estudo,
 * quando a nota de confiança da leitura é alta o bastante.
 */
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
    if (s.score >= NOTA_AUTOMATICA && a.injecaoMensal) {
      out = {
        ...out,
        injecaoMensalProjetada: Math.round(a.injecaoMensal),
        perfilSazonal: a.perfilSazonal.length === 12 ? a.perfilSazonal : out.perfilSazonal,
        distribuidora: out.distribuidora || f.distribuidora,
        fonteInjecao: "fatura",
      };
    }
  }
  return out;
}
