import { describe, expect, it } from "vitest";
import { analisarProjeto, arredondarRateio, simular } from "@/modules/rateio/engine";
import { importarSheets, nomeCurtoUsina, parseCandidatas, parseUcs, textoParaGrid, usinaVazia } from "@/modules/rateio/grid";
import { toNumber, ucKey } from "@/modules/rateio/normalize";
import { PARAMETROS_PADRAO, type Candidata, type Parametros, type UcAtual, type Usina } from "@/modules/rateio/types";

const P: Parametros = { ...PARAMETROS_PADRAO };

function uc(apelido: string, pct: number, comp: number, saldo = 0): UcAtual {
  const key = String(1000 + apelido.length * 37 + Math.round(comp));
  return { key: `${key}${apelido}`.replace(/\D/g, "") + apelido.charCodeAt(0), usina: "UFV TESTE", idUnidade: "", instalacao: apelido, apelido, subgrupo: "B3", pctAtual: pct, saldoKwh: saldo, compensavelKwh: comp, compensadoKwh: 0 };
}

function cand(inst: string, media: number, extra: Partial<Candidata> = {}): Candidata {
  return { key: ucKey(inst), instalacao: inst, apelido: `SC_${inst}`, concessionaria: "CELESC", mesReferencia: "09/2026", ligacao: "tri", ligacaoOriginal: "TRIFÁSICO", mercado: "Cativo", status: "", mediaKwh: media, consumoMinimoKwh: 100, compensavelKwh: media - 100, naUsinaGd: "", ...extra };
}

function usina(ucs: UcAtual[], injecao: number): Usina {
  return { ...usinaVazia("UFV TESTE"), distribuidora: "CELESC", meses: 1, energiaInjetadaPeriodo: injecao, ucs };
}

describe("normalização", () => {
  it("chave da UC ignora pontos, traço e zeros à esquerda", () => {
    expect(ucKey("2.645.915.011-27")).toBe("264591501127");
    expect(ucKey("0264591501127")).toBe("264591501127");
  });
  it("lê números brasileiros e internacionais", () => {
    expect(toNumber("1.234,56")).toBeCloseTo(1234.56);
    expect(toNumber("1,234.56")).toBeCloseTo(1234.56);
    expect(toNumber("3.276.000")).toBe(3276000);
    expect(toNumber("2,45%")).toBeCloseTo(2.45);
    expect(toNumber(7.5)).toBe(7.5);
  });
  it("nome curto da usina", () => {
    expect(nomeCurtoUsina("#299 - TIM CAMERGE CELESC CGH BOTELHO")).toBe("CGH BOTELHO");
    expect(nomeCurtoUsina("TIM THOPEN CELESC UFV SAFIRA (ISUS1)")).toBe("UFV SAFIRA");
  });
});

describe("arredondamento do rateio", () => {
  it("soma exatamente 100 com 2 casas", () => {
    const pct = arredondarRateio([1, 1, 1], 2, 0.01);
    expect(pct.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 10);
    expect(pct.every((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-9)).toBe(true);
  });
  it("respeita o percentual mínimo e zera pesos nulos", () => {
    const pct = arredondarRateio([1000, 0.0001, 0], 2, 0.01);
    expect(pct[1]).toBe(0.01);
    expect(pct[2]).toBe(0);
    expect(pct[0] + pct[1]).toBeCloseTo(100, 10);
  });
  it("funciona com muitas UCs pequenas", () => {
    const pesos = Array.from({ length: 400 }, (_, i) => (i === 0 ? 1e6 : 1));
    const pct = arredondarRateio(pesos, 2, 0.01);
    expect(pct.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 8);
    expect(Math.min(...pct)).toBe(0.01);
  });
});

describe("simulação", () => {
  it("crédito do mês abate o consumo, o resto sai do saldo e a sobra vira saldo", () => {
    const u = usina([], 1000);
    const r = simular(
      [
        { pct: 50, saldo: 0, comp: 300 }, // recebe 500, usa 300, guarda 200
        { pct: 50, saldo: 1000, comp: 800 }, // recebe 500, usa +300 do saldo
      ],
      u,
      { ...P, mesesSimulacao: 1 },
    );
    expect(r.saldoFinalPorUc).toEqual([200, 700]);
    expect(r.compensadoTotal).toBe(1100);
    expect(r.creditoParaSaldoTotal).toBe(200);
    expect(r.consumoDescobertoTotal).toBe(0);
  });
});

describe("análise de rateio", () => {
  it("dá menos crédito novo a quem tem saldo alto e retira quem tem saldo para o horizonte", () => {
    const u = usina([uc("SEM_SALDO", 50, 1000), uc("COM_SALDO", 30, 1000, 7000), uc("SALDO_ENORME", 20, 1000, 50000)], 1800);
    const r = analisarProjeto([u], [], { ...P, incluirNovasUcs: false }).usinas[0];
    const [a, b, c] = r.linhas;
    expect(c.acao).toBe("retirar");
    expect(c.pctProposto).toBe(0);
    expect(a.pctProposto).toBeGreaterThan(b.pctProposto);
    // queima: (7000 − 1000 de reserva) / 12 = 500 kWh/mês
    expect(b.queimaSaldoMensal).toBeCloseTo(500);
    expect(r.linhas.reduce((s, l) => s + l.pctProposto, 0)).toBeCloseTo(100, 8);
  });

  it("inclui novas UCs quando sobra injeção e não repete UC entre usinas", () => {
    const u1 = usina([uc("A", 100, 1000)], 3000);
    const u2 = { ...usina([uc("B", 100, 1000)], 2000), id: "outra", nome: "UFV OUTRA" };
    const cands = [cand("111", 2100), cand("222", 1200), cand("333", 600), cand("777", 1500), cand("444", 150)];
    const res = analisarProjeto([u1, u2], cands, P);
    const sel = res.candidatas.filter((c) => c.selecionada);
    const keys = sel.map((c) => c.candidata.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const r of res.usinas) {
      expect(r.linhas.reduce((s, l) => s + l.pctProposto, 0)).toBeCloseTo(100, 8);
      const nec = r.linhas.reduce((s, l) => s + l.necessidadeKwh, 0);
      expect(nec).toBeGreaterThanOrEqual(r.indicadores.injecaoMensal * 0.999);
    }
    // candidata abaixo do compensável mínimo (150 − 100 = 50) não entra
    expect(res.candidatas.find((c) => c.candidata.key === "444")!.elegivel).toBe(false);
  });

  it("recusa candidata já no rateio, duplicada ou em outra usina GD", () => {
    const atual = uc("A", 100, 1000);
    const u = usina([atual], 5000);
    const cands = [cand(atual.key, 3000), cand("555", 3000), cand("555", 3000), cand("666", 3000, { naUsinaGd: "UFV X" })];
    const res = analisarProjeto([u], cands, P);
    expect(res.candidatas.map((c) => c.elegivel)).toEqual([false, true, false, false]);
  });

  it("rateio proposto reduz o saldo acumulado em relação ao atual", () => {
    // rateio atual igual para todos, mas consumos muito diferentes
    const u = usina([uc("GRANDE", 50, 9000), uc("PEQUENA", 50, 1000)], 9000);
    const r = analisarProjeto([u], [], { ...P, incluirNovasUcs: false }).usinas[0];
    expect(r.proposto.saldoFinal).toBeLessThan(r.atual.saldoFinal);
    expect(r.proposto.consumoDescobertoTotal).toBeLessThan(r.atual.consumoDescobertoTotal);
  });

  it("alerta soma do rateio atual diferente de 100", () => {
    const u = usina([uc("A", 40, 1000), uc("B", 40, 1000)], 1500);
    const r = analisarProjeto([u], [], P).usinas[0];
    expect(r.alertas.some((a) => a.codigo === "soma_atual")).toBe(true);
  });
});

describe("leitura de planilhas", () => {
  it("lê UCs do Orange e candidatas, com cabeçalhos em qualquer linha", () => {
    const ucs = parseUcs([
      ["Análise"],
      [],
      ["Nome da Usina", "ID da Unidade", "N° de Instalação", "Apelido da Unidade", "Subgrupo", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh", "Zerar  Saldo", "Consumo Compensado kWh"],
      ["#1 - TIM X CELESC UFV SAFIRA", 1, "2.645.915.011-27", "SCJVE_0005", "B3", 2.45, 27632, 7499.75, 3.68, 7002.09],
      ["Totais"],
    ])!;
    expect(ucs).toHaveLength(1);
    expect(ucs[0]).toMatchObject({ key: "264591501127", pctAtual: 2.45, saldoKwh: 27632, compensavelKwh: 7499.75, apelido: "SCJVE_0005" });

    const cands = parseCandidatas(textoParaGrid("UC\tEndereço ID\tConcessionária\tTipo Tensão\tMédia kWh\n116476001110\tSCIAI_0002\tCELESC\tmonofasico\t8.049\n"))!;
    expect(cands[0]).toMatchObject({ ligacao: "mono", consumoMinimoKwh: 30, compensavelKwh: 8019 });
  });

  it("separa um export com duas usinas", () => {
    const head = ["Nome da Usina", "N° de Instalação", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh"];
    const imp = importarSheets([
      {
        name: "export",
        grid: [head, ["TIM THOPEN CELESC UFV SAFIRA", "111", 60, 0, 100], ["TIM THOPEN CELESC UFV SAFIRA", "112", 40, 0, 100], ["TIM THOPEN CELESC UFV TURQUESA", "113", 100, 0, 100]],
      },
    ]);
    expect(imp.usinas.map((u) => [u.nome, u.ucs.length, u.distribuidora])).toEqual([
      ["UFV SAFIRA", 2, "CELESC"],
      ["UFV TURQUESA", 1, "CELESC"],
    ]);
  });
});
