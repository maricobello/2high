import { describe, expect, it } from "vitest";
import { competencias, consumoPorCompetencia, definirConsumo, numerosColados, resumoConsumo, rotuloCompetencia } from "@/modules/rateio/consumo";
import { analisarProjeto } from "@/modules/rateio/engine";
import { exemplo } from "@/modules/rateio/exemplo";
import { usinaVazia } from "@/modules/rateio/grid";
import { coberturaEfetiva, rateioPlanilha, sugerirCobertura, sugerirMaximoPlanilha } from "@/modules/rateio/otimo-cobertura";
import { PARAMETROS_PADRAO, type Parametros, type UcAtual, type Usina } from "@/modules/rateio/types";

const P: Parametros = { ...PARAMETROS_PADRAO, metodo: "proporcional" };

function uc(n: number, pct: number, comp: number, saldo = 0): UcAtual {
  return { key: String(100000 + n), usina: "", idUnidade: "", instalacao: String(100000 + n), apelido: `UC${n}`, subgrupo: "B3", pctAtual: pct, saldoKwh: saldo, compensavelKwh: comp, compensadoKwh: 0 };
}
function usina(ucs: UcAtual[], injecao: number): Usina {
  return { ...usinaVazia("U"), id: "u", nome: "UFV TESTE", distribuidora: "CELESC", meses: 1, energiaInjetadaPeriodo: injecao, ucs };
}

describe("máximo compensável", () => {
  it("rateioPlanilha reproduz as fórmulas L, M e N da planilha modelo", () => {
    // compensável total 3000 > injeção 2000: L = saldo × 30%
    // UC1: L=0 -> M=1000; UC2: L=300 -> M=700; UC3: L=3000 > 1000 -> M=1000×M8
    const linhas = [
      { saldo: 0, comp: 1000 },
      { saldo: 1000, comp: 1000 },
      { saldo: 10000, comp: 1000 },
    ];
    const pct = rateioPlanilha(linhas, 2000, 0, 0.5, { casasDecimais: 2, pctMinimo: 0.01 });
    expect(pct).toEqual([45.45, 31.82, 22.73]);
    expect(pct.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    // injeção maior que o compensável: não queima saldo, M = compensável
    expect(rateioPlanilha(linhas, 5000, 0, 0.5, { casasDecimais: 2, pctMinimo: 0.01 })).toEqual([33.34, 33.33, 33.33]);
  });

  it("planilha: com UC de saldo alto, o ótimo baixa o máximo e compensa mais", () => {
    const u = usina([uc(1, 40, 1000), uc(2, 30, 1000), uc(3, 30, 1000, 20000)], 2000);
    const r = analisarProjeto([u], [], P).usinas[0];
    const s = sugerirMaximoPlanilha(u, r, P, 0.9)!;
    expect(s.ucsAfetadas).toBe(1);
    expect(s.cobertura).toBeLessThan(0.9);
    expect(s.melhor.valor).toBeGreaterThanOrEqual(Math.max(...s.curva.map((c) => c.valor)) - 1);
    expect(s.ganhoKwh).toBeGreaterThan(0);
  });

  it("planilha: sem UC afetada, mantém o valor de referência", () => {
    const u = usina([uc(1, 50, 1000), uc(2, 50, 1000)], 1500);
    const r = analisarProjeto([u], [], P).usinas[0];
    const s = sugerirMaximoPlanilha(u, r, P, 0.5)!;
    expect(s.ucsAfetadas).toBe(0);
    expect(s.cobertura).toBe(0.5);
    expect(s.ganhoKwh).toBe(0);
  });

  it("regra proporcional: busca de 50% a 100% acha o melhor ponto da curva", () => {
    const ex = exemplo();
    const s = sugerirCobertura(ex.usinas, ex.candidatas, { ...P, cobertura: 0.6 })!;
    expect(s.curva).toHaveLength(51);
    expect(s.cobertura).toBeGreaterThanOrEqual(0.5);
    expect(s.cobertura).toBeLessThanOrEqual(1);
    expect(s.melhor.valor).toBeGreaterThanOrEqual(Math.max(...s.curva.map((c) => c.valor)) - 1);
    expect(s.ganhoKwh).toBeCloseTo(s.melhor.compensadoMedio - s.atual.compensadoMedio, 6);
  }, 30_000);

  it("sem injeção não sugere", () => {
    expect(sugerirCobertura([usina([uc(1, 100, 100)], 0)], [], P)).toBeNull();
  });

  it("cobertura efetiva = crédito ÷ compensável das UCs ativas", () => {
    const u = usina([uc(1, 50, 1000), uc(2, 50, 1000)], 1500);
    const r = analisarProjeto([u], [], P).usinas[0];
    expect(coberturaEfetiva(r, "atual")).toBeCloseTo(0.75, 6);
    expect(coberturaEfetiva(r, "proposto")).toBeCloseTo(0.75, 6);
  });
});

describe("energia consumida no período", () => {
  const base = { periodoInicio: "2025-11-01", periodoFim: "2026-04-01", meses: 6, consumoMensal: [] as { mes: string; kwh: number }[] };

  it("abre uma competência por mês do período, atravessando o ano", () => {
    expect(competencias(base)).toEqual(["2025-11", "2025-12", "2026-01", "2026-02", "2026-03", "2026-04"]);
    expect(competencias({ periodoInicio: "", periodoFim: "2026-03-01", meses: 2 })).toEqual(["2026-02", "2026-03"]);
    expect(competencias({ periodoInicio: "", periodoFim: "", meses: 5 })).toEqual([]);
    expect(rotuloCompetencia("2026-09")).toBe("set/26");
  });

  it("encaixa os rótulos da planilha (SET, AGO…) no período e calcula total e média", () => {
    const u = { ...base, consumoMensal: [{ mes: "DEZ", kwh: 100 }, { mes: "JAN", kwh: 200 }, { mes: "2026-04", kwh: 300 }] };
    const linhas = consumoPorCompetencia(u);
    expect(linhas.find((l) => l.competencia === "2025-12")?.kwh).toBe(100);
    expect(linhas.find((l) => l.competencia === "2026-01")?.kwh).toBe(200);
    const r = resumoConsumo(u);
    expect(r.total).toBe(600);
    expect(r.media).toBe(200);
    expect(r.informados).toBe(3);
    expect(r.faltando).toBe(3);
  });

  it("grava e apaga uma competência sem perder as outras", () => {
    let lista = definirConsumo(base, "2026-02", 1500);
    lista = definirConsumo({ ...base, consumoMensal: lista }, "2026-03", 2500);
    expect(lista).toEqual([{ mes: "2026-02", kwh: 1500 }, { mes: "2026-03", kwh: 2500 }]);
    expect(definirConsumo({ ...base, consumoMensal: lista }, "2026-02", null)).toEqual([{ mes: "2026-03", kwh: 2500 }]);
  });

  it("lê números colados do Excel", () => {
    expect(numerosColados("1.234,5\n2.000\r\n\n3500")).toEqual([1234.5, 2000, 3500]);
    expect(numerosColados("10\t20\t30")).toEqual([10, 20, 30]);
  });

  it("a média entra no indicador de consumo da usina", () => {
    const u: Usina = { ...usina([uc(1, 100, 1000)], 1000), periodoInicio: "2026-01-01", periodoFim: "2026-02-01", meses: 2, consumoMensal: [{ mes: "2026-01", kwh: 800 }, { mes: "2026-02", kwh: 1200 }] };
    expect(analisarProjeto([u], [], P).usinas[0].indicadores.consumoMensal).toBe(1000);
  });
});
