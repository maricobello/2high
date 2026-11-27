import { describe, expect, it } from "vitest";
import { acompanhamento, anotarCiclo, registroDoCiclo } from "@/modules/rateio/acompanhamento";
import { usinaVazia } from "@/modules/rateio/grid";
import type { UcAtual } from "@/modules/rateio/types";

const uc = (n: number, compensado: number, tarifa = 0.9): UcAtual => ({ key: String(n), usina: "", idUnidade: "", instalacao: String(n), apelido: "", subgrupo: "B3", pctAtual: 50, saldoKwh: 10, compensavelKwh: 1000, compensadoKwh: compensado, tarifaKwh: tarifa });

describe("acompanhamento", () => {
  it("registra o ciclo e compara com o previsto do rateio concluído", () => {
    const u = usinaVazia("U");
    const concluido = { em: "", resultado: { proposto: { compensadoTotal: 24000, meses: Array(12).fill({}) } }, candidatas: [], parecer: null } as never;
    const reg = registroDoCiclo([uc(1, 900), uc(2, 1000)], { concluido }, "2026-12-05T10:00:00Z");
    expect(reg.compensadoKwh).toBe(1900);
    expect(reg.previstoKwh).toBe(2000);
    const hist = anotarCiclo(anotarCiclo(undefined, { ...reg, em: "2026-11-05T10:00:00Z", compensadoKwh: 1500 }), reg);
    const a = acompanhamento({ ...u, ucs: [uc(1, 900), uc(2, 1000)], historico: hist });
    expect(a.ciclos).toHaveLength(2);
    expect(a.aderencia).toBeCloseTo(0.95, 2);
    expect(a.ultimo?.reais).toBeCloseTo(1900 * 0.9, 1);
  });

  it("mesmo dia: o registro novo substitui", () => {
    const r1 = registroDoCiclo([uc(1, 100)], { concluido: null }, "2026-12-05T08:00:00Z");
    const r2 = registroDoCiclo([uc(1, 200)], { concluido: null }, "2026-12-05T18:00:00Z");
    expect(anotarCiclo(anotarCiclo(undefined, r1), r2)).toEqual([r2]);
  });
});
