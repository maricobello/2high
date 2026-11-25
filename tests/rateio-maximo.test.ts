import { describe, expect, it } from "vitest";
import { competencias, consumoPorCompetencia, definirConsumo, numerosColados, resumoConsumo, rotuloCompetencia } from "@/modules/rateio/consumo";
import { analisarProjeto } from "@/modules/rateio/engine";
import { exemplo } from "@/modules/rateio/exemplo";
import { usinaVazia } from "@/modules/rateio/grid";
import { coberturaEfetiva, limiteFisico, rateioPlanilha, sugerirCobertura, sugerirMaximoPlanilha } from "@/modules/rateio/otimo-cobertura";
import { constantesObjetivo, refinarRateio, valorUc, type ItemRefino } from "@/modules/rateio/refinar";
import { pesosValor, valorCompensado } from "@/modules/rateio/valor";
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
    expect(s.semEfeito).toBe(false);
    expect(s.cobertura).toBeLessThan(0.9);
    // sem o valor antigo, a escolha é a mesma (não há padrão)
    expect(sugerirMaximoPlanilha(u, r, P)!.cobertura).toBe(s.cobertura);
    expect(s.melhor.valor).toBeGreaterThanOrEqual(Math.max(...s.curva.map((c) => c.valor)) - 1);
    expect(s.ganhoKwh).toBeGreaterThan(0);
  });

  it("planilha: sem UC afetada, não usa padrão: vai o máximo compensável efetivo do rateio", () => {
    const u = usina([uc(1, 50, 1000), uc(2, 50, 1000)], 1500);
    const r = analisarProjeto([u], [], P).usinas[0];
    const s = sugerirMaximoPlanilha(u, r, P)!;
    expect(s.ucsAfetadas).toBe(0);
    expect(s.semEfeito).toBe(true);
    expect(s.cobertura).toBeCloseTo(coberturaEfetiva(r, "proposto")!, 3);
    // o valor antigo da planilha não muda a escolha
    expect(sugerirMaximoPlanilha(u, r, P, 0.5)!.cobertura).toBe(s.cobertura);
  });

  it("regra proporcional: busca livre (abaixo e acima de 100%) acha o melhor ponto avaliado", () => {
    const ex = exemplo();
    const s = sugerirCobertura(ex.usinas, ex.candidatas, { ...P, cobertura: 0.6 })!;
    expect(s.curva[0].cobertura).toBeLessThanOrEqual(0.05);
    expect(s.curva.at(-1)!.cobertura).toBeGreaterThanOrEqual(1.95);
    expect(s.melhor.valor).toBeGreaterThanOrEqual(Math.max(...s.curva.map((c) => c.valor)) - 1);
    // refinado até 0,1 ponto em volta do melhor
    expect(s.curva.some((c) => Math.abs(c.cobertura - s.cobertura - 0.001) < 1e-9 || Math.abs(c.cobertura - s.cobertura + 0.001) < 1e-9)).toBe(true);
    expect(s.ganhoKwh).toBeCloseTo(s.melhor.compensadoMedio - s.atual.compensadoMedio, 6);
  }, 60_000);

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
    const ind = analisarProjeto([u], [], P).usinas[0].indicadores;
    expect(ind.consumoMensal).toBe(1000);
    expect(ind.consumoEstimado).toBe(false);
    // sem valores digitados: estimativa pela soma do compensável das UCs
    const est = analisarProjeto([{ ...u, ucs: [uc(1, 60, 1000), uc(2, 40, 500)], consumoMensal: [] }], [], P).usinas[0].indicadores;
    expect(est.consumoEstimado).toBe(true);
    expect(est.consumoMensal).toBe(1500);
  });
});

describe("refino exato do otimizado", () => {
  const K = constantesObjetivo(PARAMETROS_PADRAO);
  const E = Array(12).fill(1000);
  const item = (comp: number, saldo: number, pct0: number, valor = 1): ItemRefino => ({ comp, saldo, pct0, valor, reserva: comp, ativo: true });

  it("o ganho de cada UC é côncavo no percentual", () => {
    const it0 = item(400, 900, 20);
    const v = Array.from({ length: 101 }, (_, k) => valorUc(it0, k, E, K));
    for (let k = 1; k < 100; k++) expect(v[k + 1] - v[k]).toBeLessThanOrEqual(v[k] - v[k - 1] + 1e-9);
  });

  it("chega ao ótimo global da grade (confere com força bruta)", () => {
    const itens = [item(500, 0, 30), item(300, 2500, 40), item(250, 100, 30, 1.4)];
    const f = (x: number[]) => x.reduce((a, p, i) => a + valorUc(itens[i], p, E, K), 0);
    let melhor = -Infinity;
    for (let a = 1; a <= 98; a++) for (let b = 1; a + b <= 99; b++) melhor = Math.max(melhor, f([a, b, 100 - a - b]));
    const r = refinarRateio(itens, [34, 33, 33], E, K, 0, 1);
    expect(r.pct.reduce((a, b) => a + b, 0)).toBe(100);
    expect(r.depois).toBeCloseTo(melhor, 6);
    expect(r.depois).toBeGreaterThanOrEqual(r.antes);
  });

  it("UC fora do rateio fica em 0 e o mínimo é respeitado", () => {
    const itens = [item(500, 0, 50), { ...item(300, 0, 50), ativo: false }, item(0, 0, 0)];
    const r = refinarRateio(itens, [99.99, 0, 0.01], E, K, 2, 0.01);
    expect(r.pct[1]).toBe(0);
    expect(r.pct[2]).toBeGreaterThanOrEqual(0.01);
    expect(r.pct.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
  });

  it("com valor por subgrupo, o crédito escasso vai primeiro para o kWh mais caro", () => {
    const pesos = pesosValor(["A4", "B3"], { valorKwhSubgrupo: { A4: 0.5, B3: 1 }, tarifaKwh: 0 });
    expect(pesos[1]).toBeGreaterThan(pesos[0]);
    // injeção de 1000 para 2 UCs de 800: a B3 recebe quase todo o seu consumo (o resto é
    // margem para o cenário de consumo menor, que não deixa crédito encalhar)
    const itens = [item(800, 0, 50, pesos[0]), item(800, 0, 50, pesos[1])];
    const r = refinarRateio(itens, [50, 50], E, K, 2, 0.01);
    expect(r.pct[1]).toBeGreaterThan(75);
    expect(r.pct[1]).toBeLessThanOrEqual(80);
    expect(pesosValor(["A4", "B3"], { valorKwhSubgrupo: {}, tarifaKwh: 0.9 })).toEqual([1, 1]);
  });

  it("no motor: otimizado refinado soma 100%, não perde para o arredondado e respeita o limite físico", () => {
    const u = usina([uc(1, 30, 900, 200), uc(2, 30, 700, 5000), uc(3, 20, 400), uc(4, 20, 300, 50)], 2000);
    // pesos contínuos "do MILP" de propósito fora da grade
    const pO = { ...P, metodo: "otimizado" as const };
    const chave = analisarProjeto([u], [], pO).chave;
    const otim = { chave, status: "Optimal", otimo: true, objetivo: 0, tempoMs: 0, variaveis: 0, restricoes: 0, porUsina: { u: { pctAtuais: [33.333, 13.333, 33.334, 20], novas: [] } } };
    const r = analisarProjeto([u], [], pO, otim).usinas[0];
    expect(r.metodo).toBe("otimizado");
    expect(r.refino).toBeDefined();
    expect(r.refino!.ganhoObjetivo).toBeGreaterThanOrEqual(0);
    expect(r.linhas.reduce((a, l) => a + l.pctProposto, 0)).toBeCloseTo(100, 6);
    expect(r.proposto.compensadoTotal).toBeLessThanOrEqual(limiteFisico(r, "proposto", P.mesesSimulacao) + 1e-6);
    expect(r.atual.compensadoTotal).toBeLessThanOrEqual(limiteFisico(r, "atual", P.mesesSimulacao) + 1e-6);
    // R$ UC a UC
    const pv = { ...P, tarifaKwh: 0, valorKwhSubgrupo: { B3: 0.9 } };
    expect(valorCompensado(r, "proposto", pv)).toBeCloseTo(r.proposto.compensadoTotal * 0.9, 3);
    expect(valorCompensado(r, "proposto", { ...P, tarifaKwh: 0 })).toBeNull();
  });
});

describe("campo numérico no formato brasileiro", () => {
  it("ponto é milhar e vírgula é decimal", async () => {
    const { lerNumeroBr, formatarBr } = await import("@/components/admin/rateio/numero");
    expect(lerNumeroBr("619.886,12")).toBe(619886.12);
    expect(lerNumeroBr("619.886")).toBe(619886);
    expect(lerNumeroBr("1.234.567")).toBe(1234567);
    expect(lerNumeroBr("619886,12")).toBe(619886.12);
    expect(lerNumeroBr("0,85")).toBe(0.85);
    expect(lerNumeroBr("447036")).toBe(447036);
    expect(lerNumeroBr("")).toBeNull();
    expect(formatarBr(619886.12)).toBe("619.886,12");
  });
});

describe("máximo compensável sem extremos arbitrários", () => {
  it("curva plana: escolhe o valor coerente com a cobertura efetiva, não o primeiro da busca", () => {
    // 2 UCs, injeção quase igual ao compensável: qualquer cobertura rende o mesmo
    const u = usina([uc(1, 60, 70000), uc(2, 40, 60000, 5000)], 123257);
    const s = sugerirCobertura([u], [], P)!;
    expect(s.cobertura).toBeGreaterThan(0.5);
    expect(Math.abs(s.cobertura - (s.melhor.efetiva ?? 0))).toBeLessThan(0.1);
  }, 60_000);
});
