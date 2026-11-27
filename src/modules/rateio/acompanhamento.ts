/**
 * Acompanhamento: quanto o rateio de fato compensou (lista de UCs do Orange, coluna
 * "Consumo Compensado") contra o que o rateio previa, e quanto isso vale em R$.
 */
import type { RegistroCiclo, UcAtual, Usina } from "./types";
import { tarifaPorSubgrupo } from "./valor";

/** Registro do ciclo a partir de uma lista de UCs (e do rateio concluído, se houver). */
export function registroDoCiclo(ucs: UcAtual[], u: Pick<Usina, "concluido">, em = new Date().toISOString()): RegistroCiclo {
  const r = u.concluido?.resultado;
  const meses = r?.proposto.meses.length || 0;
  return {
    em,
    compensadoKwh: ucs.reduce((a, c) => a + Math.max(0, c.compensadoKwh), 0),
    saldoKwh: ucs.reduce((a, c) => a + Math.max(0, c.saldoKwh), 0),
    compensavelKwh: ucs.reduce((a, c) => a + Math.max(0, c.compensavelKwh), 0),
    ucs: ucs.length,
    previstoKwh: r && meses ? r.proposto.compensadoTotal / meses : null,
  };
}

/** Acrescenta o ciclo ao histórico (no máximo 1 por dia; o mais novo substitui o do mesmo dia). */
export function anotarCiclo(historico: RegistroCiclo[] | undefined, reg: RegistroCiclo): RegistroCiclo[] {
  const dia = reg.em.slice(0, 10);
  return [...(historico ?? []).filter((h) => h.em.slice(0, 10) !== dia), reg].sort((a, b) => a.em.localeCompare(b.em)).slice(-36);
}

export interface Acompanhamento {
  ciclos: (RegistroCiclo & { reais: number | null })[];
  ultimo: (RegistroCiclo & { reais: number | null }) | null;
  /** Realizado ÷ previsto no último ciclo com previsão. */
  aderencia: number | null;
  tarifa: number | null;
}

/** Ciclos com valor em R$ (tarifa típica das UCs, ou a informada) e a aderência ao previsto. */
export function acompanhamento(u: Usina, tarifaInformada = 0): Acompanhamento {
  const base = u.historico?.length ? u.historico : u.ucs.length ? [registroDoCiclo(u.ucs, u, "")] : [];
  const tarifa = tarifaInformada > 0 ? tarifaInformada : tarifaPorSubgrupo(u.ucs.map((c) => ({ subgrupo: c.subgrupo, tarifa: c.tarifaKwh }))).geral;
  const ciclos = base.filter((c) => c.compensadoKwh > 0).map((c) => ({ ...c, reais: tarifa ? c.compensadoKwh * tarifa : null }));
  const ultimo = ciclos.at(-1) ?? null;
  const comPrev = [...ciclos].reverse().find((c) => c.previstoKwh && c.previstoKwh > 0);
  return { ciclos, ultimo, aderencia: comPrev ? comPrev.compensadoKwh / comPrev.previstoKwh! : null, tarifa };
}
