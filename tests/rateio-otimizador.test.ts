import highsLoader from "highs";
import { beforeAll, describe, expect, it } from "vitest";
import { analisarProjeto } from "@/modules/rateio/engine";
import { usinaVazia } from "@/modules/rateio/grid";
import { ucKey } from "@/modules/rateio/normalize";
import { interpretarSolucao, montarModelo, OPCOES_SOLVER } from "@/modules/rateio/otimizador";
import { PARAMETROS_PADRAO, type Candidata, type OtimizacaoResultado, type Parametros, type UcAtual, type Usina } from "@/modules/rateio/types";

let highs: Awaited<ReturnType<typeof highsLoader>>;
beforeAll(async () => {
  highs = await highsLoader();
});

const P: Parametros = { ...PARAMETROS_PADRAO, metodo: "otimizado" };

function uc(n: number, pct: number, comp: number, saldo = 0): UcAtual {
  return { key: String(100000 + n), usina: "", idUnidade: "", instalacao: String(100000 + n), apelido: `UC${n}`, subgrupo: "B3", pctAtual: pct, saldoKwh: saldo, compensavelKwh: comp, compensadoKwh: 0 };
}
function cand(n: number, comp: number): Candidata {
  const inst = String(900000 + n);
  return { key: ucKey(inst), instalacao: inst, apelido: `C${n}`, concessionaria: "CELESC", mesReferencia: "", ligacao: "tri", ligacaoOriginal: "TRI", mercado: "Cativo", status: "", mediaKwh: comp + 100, consumoMinimoKwh: 100, compensavelKwh: comp, naUsinaGd: "" };
}
function usina(id: string, ucs: UcAtual[], injecao: number): Usina {
  return { ...usinaVazia(id), id, nome: id, distribuidora: "CELESC", meses: 1, energiaInjetadaPeriodo: injecao, ucs };
}

function otimizar(usinas: Usina[], cands: Candidata[], p: Parametros): OtimizacaoResultado {
  const base = analisarProjeto(usinas, cands, p);
  const m = montarModelo(usinas, base.candidatas, p);
  const sol = highs.solve(m.lp, OPCOES_SOLVER as never);
  return interpretarSolucao(m, sol.Status, sol.ObjectiveValue, sol.Columns as never, 0);
}

describe("otimizador (HiGHS)", () => {
  it("acha solução ótima, soma 100% e deixa menos saldo que a regra proporcional", () => {
    const u = usina("U1", [uc(1, 40, 3000), uc(2, 30, 1000, 20000), uc(3, 20, 2000, 3000), uc(4, 10, 500)], 6000);
    const o = otimizar([u], [], P);
    expect(o.otimo).toBe(true);
    const r = analisarProjeto([u], [], P, o);
    expect(r.metodo).toBe("otimizado");
    const ro = r.usinas[0];
    expect(ro.linhas.reduce((s, l) => s + l.pctProposto, 0)).toBeCloseTo(100, 8);
    const prop = analisarProjeto([u], [], { ...P, metodo: "proporcional" }).usinas[0];
    expect(ro.proposto.saldoFinal).toBeLessThanOrEqual(prop.proposto.saldoFinal + 1);
    expect(ro.propostoEstresse.saldoFinal).toBeLessThanOrEqual(prop.propostoEstresse.saldoFinal + 1);
    expect(ro.validacoes.filter((v) => !v.ok && v.nivel === "erro")).toEqual([]);
  });

  it("inclui candidatas quando sobra injeção e cada uma vai para uma usina só", () => {
    const a = usina("A", [uc(1, 100, 1000)], 4000);
    const b = usina("B", [uc(2, 100, 1000)], 4000);
    const cands = [cand(1, 3000), cand(2, 3000), cand(3, 2500), cand(4, 200)];
    const o = otimizar([a, b], cands, P);
    expect(o.otimo).toBe(true);
    const keys = Object.values(o.porUsina).flatMap((x) => x.novas.map((n) => n.key));
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.length).toBeGreaterThanOrEqual(2);
    const r = analisarProjeto([a, b], cands, P, o);
    for (const ru of r.usinas) expect(ru.proposto.creditoParaSaldoTotal).toBeLessThan(ru.atual.creditoParaSaldoTotal);
  });

  it("compensa pelo menos tanto quanto a regra proporcional (mesmas UCs)", () => {
    const u = usina("U", [uc(1, 50, 1000, 5000), uc(2, 30, 3000), uc(3, 20, 800, 12000)], 3000);
    const q = { ...P, incluirNovasUcs: false };
    const o = otimizar([u], [], q);
    const ot = analisarProjeto([u], [], q, o).usinas[0];
    const pr = analisarProjeto([u], [], { ...q, metodo: "proporcional" }).usinas[0];
    expect(ot.proposto.compensadoTotal).toBeGreaterThanOrEqual(pr.proposto.compensadoTotal - 0.002 * ot.proposto.injetadoTotal);
    expect(ot.propostoEstresse.compensadoTotal).toBeGreaterThanOrEqual(pr.propostoEstresse.compensadoTotal - 0.002 * ot.proposto.injetadoTotal);
  });

  it("solução de outra entrada não é usada (cai na regra proporcional)", () => {
    const u = usina("U", [uc(1, 50, 1000), uc(2, 50, 1000)], 1500);
    const o = otimizar([u], [], P);
    const mudou = { ...u, energiaInjetadaPeriodo: 1800 };
    expect(analisarProjeto([mudou], [], P, o).metodo).toBe("proporcional");
  });
});
