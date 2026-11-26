import { describe, expect, it } from "vitest";
import { analisarProjeto, arredondarRateio, simular } from "@/modules/rateio/engine";
import { importarSheets, nomeCurtoUsina, parseCandidatas, parseUcs, textoParaGrid, usinaVazia } from "@/modules/rateio/grid";
import { toNumber, toPct, ucKey } from "@/modules/rateio/normalize";
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

describe("correções da revisão", () => {
  it("números: zero à esquerda é decimal, milhares com vírgula, percentual com ponto", () => {
    expect(toNumber("0.125")).toBeCloseTo(0.125);
    expect(toNumber("1,234,567")).toBe(1234567);
    expect(toNumber("-1.234")).toBe(-1234);
    expect(toPct("33.333")).toBeCloseTo(33.333);
    expect(toPct("2,45")).toBeCloseTo(2.45);
  });

  it("percentual em fração é convertido por usina num export com várias", () => {
    const head = ["Nome da Usina", "N° de Instalação", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh"];
    const imp = importarSheets([{ name: "x", grid: [head, ["UFV A", "1", 0.6, 0, 100], ["UFV A", "2", 0.4, 0, 100], ["UFV B", "3", 0.5, 0, 100], ["UFV B", "4", 0.5, 0, 100]] }]);
    expect(imp.usinas.flatMap((u) => u.ucs.map((c) => c.pctAtual))).toEqual([60, 40, 50, 50]);
  });

  it("CSV com vírgula respeita aspas", () => {
    const g = textoParaGrid('N° de Instalação,% do Rateio,Consumo Compensável\n123,"2,45",100');
    expect(parseUcs(g)![0]).toMatchObject({ pctAtual: 2.45, compensavelKwh: 100 });
  });

  it("sem retirada, UC sem necessidade fica no mínimo e não some", () => {
    const u = usina([uc("A", 50, 1000), uc("B", 30, 1000, 100000), uc("Z", 20, 0)], 900);
    const r = analisarProjeto([u], [], { ...P, permitirRetirar: false, incluirNovasUcs: false }).usinas[0];
    expect(r.linhas.map((l) => l.pctProposto)).toEqual([99.98, 0.01, 0.01]);
    expect(r.indicadores.retiradas).toBe(0);
  });

  it("qualquer mudança de percentual sai como aumentar ou reduzir", () => {
    const u = usina([uc("A", 60, 1000), uc("B", 40, 600)], 1000);
    const r = analisarProjeto([u], [], { ...P, incluirNovasUcs: false }).usinas[0];
    expect(r.linhas.map((l) => l.acao)).toEqual(["aumentar", "reduzir"]);
  });

  it("alerta quando as casas decimais não comportam todas as UCs", () => {
    const ucs = Array.from({ length: 150 }, (_, i) => uc(`U${i}`, 100 / 150, 1000));
    const r = analisarProjeto([usina(ucs, 100000)], [], { ...P, casasDecimais: 0, pctMinimo: 1, incluirNovasUcs: false }).usinas[0];
    expect(r.alertas[0].codigo).toBe("casas_insuficientes");
  });

  it("mês de início fora do intervalo não gera NaN", () => {
    const r = simular([{ pct: 100, saldo: 0, comp: 100 }], usina([], 100), { ...P, mesInicio: 0 });
    expect(Number.isFinite(r.saldoFinal)).toBe(true);
  });

  it("candidata com 'Na Usina GD' preenchida não é elegível e cabeçalhos variantes são lidos", () => {
    const c = parseCandidatas([["Nº da Instalação", "Média kWh", "Na Usina GD"], ["123", 5000, "UFV X"]])!;
    expect(c[0].naUsinaGd).toBe("UFV X");
    const u = parseUcs([["N° Instalação", "% do Rateio", "Consumo Compensável kWh"], ["9", 100, 10]])!;
    expect(u).toHaveLength(1);
  });
});

describe("mesma usina em mais de uma aba", () => {
  it("junta abas com as mesmas UCs e tira o nome do título quando falta a coluna", () => {
    const comNome = [
      ["Nome da Usina", "N° de Instalação", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh"],
      ["#1 - TIM X CELESC UFV TESTE", "111111", 60, 0, 100],
      ["#1 - TIM X CELESC UFV TESTE", "222222", 40, 0, 100],
    ];
    const semNome = [
      ["Rateio Otimizado GD — UFV Teste (#1 TIM)"],
      [],
      ["N° de Instalação", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh"],
      ["111111", 60, 0, 100],
      ["222222", 40, 0, 100],
    ];
    const vazia = [["UC", "Endereço ID", "Média kWh", "Compensável"], ["", "", "", 0]];
    const imp = importarSheets([
      { name: "Rateio Teste", grid: semNome },
      { name: "Análise do Rateio", grid: comNome },
      { name: "Novas UCs", grid: vazia },
    ]);
    expect(imp.usinas.map((u) => [u.nome, u.ucs.length])).toEqual([["UFV TESTE", 2]]);
    expect(imp.avisos.some((a) => a.includes("lista de novas UCs vazia"))).toBe(true);
  });
});

describe("consumo mínimo das UCs atuais", () => {
  it("lê a coluna quando existe, ou deduz pela ligação; grupo A não tem; ausente fica null", async () => {
    const { parseUcs } = await import("@/modules/rateio/grid");
    const ucs = parseUcs([
      ["N° de Instalação", "Subgrupo", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh", "Consumo Mínimo", "Tipo de Ligação"],
      ["1001", "B3", 50, 0, 900, 100, ""],
      ["1002", "B3", 30, 0, 500, "", "Bifásico"],
      ["1003", "A4", 10, 0, 5000, "", ""],
      ["1004", "B3", 10, 0, 300, "", ""],
    ])!;
    expect(ucs.map((u) => u.consumoMinimoKwh)).toEqual([100, 50, 0, null]);
    // export padrão do Orange (sem as colunas): continua lendo, mínimo não informado
    const orange = parseUcs([
      ["N° de Instalação", "Subgrupo", "% do Rateio", "Saldo kWh", "Consumo Compensável kWh"],
      ["2001", "B3", 100, 0, 900],
    ])!;
    expect(orange[0].consumoMinimoKwh).toBeNull();
  });
});
