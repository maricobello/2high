import { describe, expect, it } from "vitest";
import { autoAplicar } from "@/modules/rateio/automacao";
import { aplicacaoDaFatura, compararRateio, lerFaturaTexto, mesesEmOperacao, mesIso, scoreFatura } from "@/modules/rateio/fatura";
import { usinaVazia } from "@/modules/rateio/grid";
import { checarPainel, inferirMeses, lerPainelTexto, scorePainel } from "@/modules/rateio/painel";

// Layout de fatura de UC geradora (CELESC Grupo A), com números FICTÍCIOS
const FATURA = `
COMERCIAL - A4 horosazonal verde - TRIFÁSICO
NOTA FISCAL Nº 1 SERIE: 001 DATA EMISSAO: 14/10/2026
09/2026  27/10/2026  R$ 1.000,00  31/08/2026  30/09/2026  30  Lida  31/10/2026
HISTÓRICO DE CONSUMO
SET/26  AGO/26  JUL/26  JUN/26  MAI/26  ABR/26  MAR/26  FEV/26  JAN/26  DEZ/25  NOV/25  OUT/25
Consumo Fora Ponta  1.000,00 2.000,00  1.000,00  1.000,00 1.100,00  1.200,00 1.300,00  1.400,00  1.500,00  1.600,00  300,00  0,00  0,00  0,00  0,00
Consumo Ponta  100,00 200,00  100,00  100,00  110,00  120,00  130,00  140,00  150,00  160,00  30,00  0,00  0,00  0,00  0,00
Energia Injetada Fora Ponta 1.000.000,00 2.000.000,00 300.000,00 300.000,00 310.000,00 320.000,00 330.000,00 340.000,00 350.000,00 360.000,00 50.000,00  0,00  0,00  0,00  0,00
Energia Injetada Ponta  0,00  0,00  0,00  0,00  0,00  0,00  0,00  0,00  0,00  100,00  200,00  0,00  0,00  0,00  0,00
Demandas  Ponta (PT) Fora Ponta (FP)
SET/26  AGO/26  JUL/26  JUN/26  MAI/26  ABR/26
FP  PT  FP  PT  FP  PT  FP  PT  FP  PT  FP  PT
Consumo  1000  100  1100  110  1200  120  1300  130  1400  140  1500  150
Energia Injetada  300000  0  310000  0  320000  0  330000  0  340000  0  350000  0
Excedente de energia distribuído  298900  0  308790  0  318680  0  328570  0  338460  0  348350  0
Saldo de créditos atualizado  0  0  0  0  0  0  0  0  0  0  0  0
Conversão entre postos horários  902-  563  1010-  629  1140-  710  999-  622  906-  564  949-  591
`.split("\n");

describe("fatura da usina", () => {
  it("meses em vários formatos", () => {
    expect(mesIso("SET/26")).toBe("2026-09");
    expect(mesIso("09/2026")).toBe("2026-09");
    expect(mesIso("dez/2025")).toBe("2025-12");
    expect(mesIso("13/2026")).toBeNull();
  });

  it("lê referência, histórico de 12 meses e demonstrativo FP/PT", () => {
    const f = lerFaturaTexto(FATURA);
    expect(f.mesReferencia).toBe("2026-09");
    expect(f.injetada["2026-09"]).toBe(300000);
    expect(f.injetada["2026-03"]).toBe(360100); // FP + PT
    expect(f.injetada["2025-10"]).toBe(0);
    expect(f.excedente["2026-04"]).toBe(348350);
    expect(f.consumo["2026-08"]).toBe(1210); // FP + PT
    expect(f.saldoKwh).toBe(0);
  });

  it("média em operação: excedente onde existe, injeção − consumo nos outros meses; tira entrada em operação", () => {
    const f = lerFaturaTexto(FATURA);
    expect(mesesEmOperacao(f.injetada).map(([m]) => m)[0]).toBe("2026-03"); // FEV (50 mil) é entrada parcial
    const a = aplicacaoDaFatura(f);
    expect(a.mesesUsados).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"]);
    const esperado = (298900 + 308790 + 318680 + 328570 + 338460 + 348350 + (360100 - 1760)) / 7;
    expect(a.injecaoMensal).toBeCloseTo(esperado, 6);
    expect(a.perfilSazonal).toEqual([]); // menos de 12 meses em operação
  });

  it("compara rateio da fatura com o Orange", () => {
    const d = compararRateio(
      [
        { instalacao: "111111", key: "111111", pct: 50 },
        { instalacao: "222222", key: "222222", pct: 50 },
      ],
      [
        { key: "111111", instalacao: "111111", pctAtual: 50 },
        { key: "333333", instalacao: "333333", pctAtual: 50 },
      ],
    );
    expect(d.iguais).toBe(1);
    expect(d.soNaFatura.map((x) => x.key)).toEqual(["222222"]);
    expect(d.soNoOrange.map((x) => x.key)).toEqual(["333333"]);
  });
});

describe("tela do Orange", () => {
  const TXT = "Energia kWh\nEstimada\t4.000.000\nInjetada\t3.000.000\nCompensada 2.500.000\nSaldo Inicial 400.000\nSaldo Utilizado 10.000\nSaldo Vencido 0\nSaldo Adicionado 20.000\nSaldo Acumulado\n410.000\nGeração Realizada 3.500.000\nConsumo da Usina 20.000\nDivergência de Faturamento -500.000,0\nBalanço Energia Injetada 1.400.000";
  it("lê rótulo e valor (mesma linha ou linha seguinte)", () => {
    const v = lerPainelTexto(TXT);
    expect(v).toMatchObject({ estimada: 4000000, injetada: 3000000, compensada: 2500000, saldoInicial: 400000, saldoAcumulado: 410000, geracaoRealizada: 3500000, consumoUsina: 20000, divergencia: -500000 });
  });
  it("confere saldo e compara com a soma das UCs", () => {
    const v = lerPainelTexto(TXT);
    const c = checarPainel(v, { saldoUcs: 409000, compensadoUcsMes: 0, meses: 8, injecaoFaturaPeriodo: 3010000 });
    expect(c.find((x) => x.titulo.startsWith("Saldo fecha"))!.ok).toBe(true);
    expect(c.find((x) => x.titulo.startsWith("Saldo acumulado bate"))!.ok).toBe(true);
    expect(c.find((x) => x.titulo.startsWith("Injetada na tela"))!.ok).toBe(true);
    expect(c.find((x) => x.titulo.startsWith("Divergência"))!.ok).toBe(false); // −500 mil em 3 mi
  });
});

describe("nota de confiança e automação", () => {
  const f = lerFaturaTexto(FATURA);
  // soma dos 8 meses com injeção (FEV a SET) do layout fictício
  const PAINEL = "Estimada 3.000.000\nInjetada 2.360.300\nCompensada 2.000.000\nSaldo Inicial 100.000\nSaldo Utilizado 5.000\nSaldo Vencido 0\nSaldo Adicionado 15.000\nSaldo Acumulado 110.000\nGeração Realizada 2.500.000\nConsumo da Usina 10.000\nDivergência de Faturamento -1.000\nBalanço Energia Injetada 300.000";

  it("fatura coerente tem nota alta; excedente que não fecha derruba a nota", () => {
    const s = scoreFatura(f);
    expect(s.score).toBeGreaterThanOrEqual(80);
    const ruim = { ...f, excedente: { ...f.excedente, "2026-09": 200000 } };
    expect(scoreFatura(ruim).score).toBeLessThan(s.score);
  });

  it("descobre os meses do período da tela cruzando com a fatura", () => {
    expect(inferirMeses(2360300, f.injetada)).toEqual({ meses: 8, diferenca: 0 });
    expect(inferirMeses(9_999_999, f.injetada)).toBeNull();
  });

  it("tela com saldo que fecha e injetada que bate tem nota alta; dígito errado derruba", () => {
    const v = lerPainelTexto(PAINEL);
    const ok = scorePainel({ valores: v, meses: 8, fonte: "imagem", lidoEm: "" }, f.injetada);
    expect(ok.score).toBeGreaterThanOrEqual(80);
    const errado = scorePainel({ valores: { ...v, saldoAcumulado: 119000 }, meses: 8, fonte: "imagem", lidoEm: "" }, f.injetada);
    expect(errado.score).toBeLessThan(NOTA);
  });

  it("aplica fatura e tela sozinho quando a nota é alta e respeita edição manual", () => {
    const base = usinaVazia("UFV TESTE");
    const u = autoAplicar({ ...base, fatura: f, painel: { valores: lerPainelTexto(PAINEL), meses: null, fonte: "texto", lidoEm: "" } });
    expect(u.painel!.meses).toBe(8);
    expect(u.painel!.mesesInferidos).toBe(true);
    expect(u.fontePeriodo).toBe("painel");
    expect(u.meses).toBe(8);
    expect(u.energiaInjetadaPeriodo).toBe(2360300);
    expect(u.fonteInjecao).toBe("fatura");
    expect(u.injecaoMensalProjetada).toBe(Math.round(aplicacaoDaFatura(f).injecaoMensal!));
    const manual = autoAplicar({ ...base, injecaoMensalProjetada: 123, fonteInjecao: "manual", fatura: f });
    expect(manual.injecaoMensalProjetada).toBe(123);
  });
});

const NOTA = 70;

describe("demanda da usina (fatura)", () => {
  it("lê contratada, registrada, ultrapassagem e a despesa", async () => {
    const { lerDemanda, demandaSugerida } = await import("@/modules/rateio/demanda");
    const linhas = [
      "(4U) Demanda  KW  12,960  25,709100  333,19  276,56 4,12  0,89  13,85  333,19 17,00  56,64 20,270000",
      "(5N) Diferença da Demanda Contratada  KW  987,040  21,339090  21.062,54  21.062,53 4,12  0,89  1.055,24  0,00  0,00  0,00 20,270000",
      "(65) Ultrapassagem de Demanda Injetada  KW  2.219,840  9,053580  20.097,51  20.097,51 4,12  0,89  1.006,89  0,00  0,00  0,00 8,600000",
      "Demandas  Ponta (PT) Fora Ponta (FP)",
      "Demanda  1000 KW",
      "Número Medidor  99999999 Amarela R$ 0,01885  30  Medida  13KW  13KW",
      "Constante de Faturamento  0,36  Demanda de Injeção  1000 KW  Medida G  0KW  3.220KW",
      "Faturada  1.000KW",
      "Ultrapassagem",
      "2.220KW",
    ];
    const d = lerDemanda(linhas)!;
    expect(d.contratadaKw).toBe(1000);
    expect(d.contratadaConsumoKw).toBe(1000);
    expect(d.registradaKw).toBe(3220);
    expect(d.registradaConsumoKw).toBe(13);
    expect(d.ultrapassagemKw).toBe(2220);
    expect(d.despesaUltrapassagem).toBe(20097.51);
    expect(d.itens.map((i) => i.codigo)).toEqual(["4U", "5N", "65"]);
    expect(demandaSugerida(d)).toBe(3220);
    expect(lerDemanda(["Consumo 123 kWh"])).toBeNull();
  });

  it("autoAplicar leva a demanda da fatura para a usina e gera o alerta", async () => {
    const { lerFaturaTexto } = await import("@/modules/rateio/fatura");
    const { autoAplicar } = await import("@/modules/rateio/automacao");
    const { usinaVazia } = await import("@/modules/rateio/grid");
    const { analisarProjeto } = await import("@/modules/rateio/engine");
    const { PARAMETROS_PADRAO } = await import("@/modules/rateio/types");
    const f = lerFaturaTexto(["(65) Ultrapassagem de Demanda Injetada KW 2.219,840 9,053580 20.097,51 20.097,51", "Demanda de Injeção 1000 KW Medida G 0KW 3.220KW"], "f.pdf");
    const u = autoAplicar({ ...usinaVazia("U"), meses: 1, energiaInjetadaPeriodo: 1000, ucs: [{ key: "1", usina: "", idUnidade: "", instalacao: "1", apelido: "", subgrupo: "B3", pctAtual: 100, saldoKwh: 0, compensavelKwh: 900, compensadoKwh: 0 }], fatura: f });
    expect(u.demanda).toMatchObject({ contratadaKw: 1000, registradaKw: 3220, despesaUltrapassagem: 20097.51, fonte: "fatura" });
    // fatura salva sem a demanda lida (versão antiga) mas com o texto: relê
    const semDemanda = { ...f, demanda: undefined };
    expect(autoAplicar({ ...u, demanda: null, fatura: semDemanda }).demanda?.registradaKw).toBe(3220);
    // digitada não é sobrescrita
    expect(autoAplicar({ ...u, demanda: { ...u.demanda!, contratadaKw: 4000, fonte: "manual" } }).demanda?.contratadaKw).toBe(4000);
    const r = analisarProjeto([u], [], { ...PARAMETROS_PADRAO, metodo: "proporcional" }).usinas[0];
    expect(r.alertas.some((a) => a.codigo === "ultrapassagem_demanda")).toBe(true);
  });
});

describe("fatura em outros formatos (RGE/CPFL)", () => {
  // trechos no formato da RGE Sul, sem dados de cliente
  const linhas = [
    "RGE SUL DISTRIBUIDORA DE ENERGIA S.A.",
    "JUL/2026  13/08/2026  R$ 14.884,36",
    "Consumo Ponta [KWh] - TUSD JUL/26  kWh  213,3000  1,83490000  2,31950305  494,75  494,75  17,00  84,11  3,41  15,85",
    "Demanda [kW] - TUSD JUL/26  kW  24,9600  28,55000000  29,95512821  747,68  6,21  28,86 Demanda kW  30",
    "Demanda [kW] - TUSD JUL/26  kW  5,0400  28,55000000  36,08928572  181,89  181,89  17,00  30,92  1,25  5,83 Geração kW  1.000",
    "11111111  Demanda Ativa - kW  Ponta  000008  000008  0,60000  5",
    "11111111  Energia Injetada - kW  Ponta  007509  007510  6,00000  6",
    "11111111  Energia Injetada - kW Fora Ponta  347032  367795  6,00000  124.578",
    "Mínimo  21.483  kWh Injetado Ponta  7  www.exemplo.com.br",
    "Máximo  24.255  kWh Injetado FPonta  124.580",
    "Consumo Ponta - [kWh]  N° DIAS FAT  Consumo Fora de Ponta - [kWh] N° DIAS FAT  Demanda - [kW]  Nº DIAS FAT",
    "JUL 26 llllllllllll  213,00  31  JUL 26 lllllllllll  1117,00  31  JUL 26 llllllll  5,00  31",
    "JUN 26 llllllllll  200,00  30  JUN 26 lllllllll  1065,00  30  JUN 26 llllllll  5,00  30",
    "AGO 25 llllllllll  264,00  31  AGO 25 lllllllll  1608,00  31  AGO 25  0,00  31",
    "Saldo em Energia da Instalação: Ponta 0,0000000000 kWh  Caso não ocorra o débito utilize esta conta para pagamento.",
    "Fora Ponta 35.220,0000000000 kWh",
  ];

  it("lê injetada do mês, confere com o medidor e monta o histórico do gráfico", async () => {
    const { lerFaturaTexto, scoreFatura, aplicacaoDaFatura } = await import("@/modules/rateio/fatura");
    const f = lerFaturaTexto(linhas, "rge.pdf");
    expect(f.distribuidora).toBe("RGE");
    expect(f.mesReferencia).toBe("2026-07");
    expect(f.injetada["2026-07"]).toBe(124587);
    expect(f.injetadaMedidor).toBe(124584);
    expect(f.saldoKwh).toBe(35220);
    expect(f.consumo["2026-07"]).toBe(1330);
    expect(f.consumo["2026-06"]).toBe(1265);
    expect(f.consumo["2025-08"]).toBe(1872);
    expect(aplicacaoDaFatura(f).injecaoMensal).toBe(124587 - 1330);
    const s = scoreFatura(f);
    expect(s.score).toBeGreaterThanOrEqual(70);
    expect(s.itens.some((i) => /medidor/.test(i.texto) && i.ok)).toBe(true);
    expect(f.demanda).toMatchObject({ contratadaKw: 1000, contratadaConsumoKw: 30, registradaConsumoKw: 5, despesaUltrapassagem: 0 });
    expect(f.demanda!.itens.map((i) => i.valor)).toEqual([747.68, 181.89]);
  });

  it("fatura de 1 mês não substitui a média do período da tela do Orange", async () => {
    const { lerFaturaTexto } = await import("@/modules/rateio/fatura");
    const { autoAplicar } = await import("@/modules/rateio/automacao");
    const { usinaVazia } = await import("@/modules/rateio/grid");
    const f = lerFaturaTexto(linhas, "rge.pdf");
    const so = autoAplicar({ ...usinaVazia("U"), fatura: f });
    expect(so.injecaoMensalProjetada).toBe(124587 - 1330);
    const comPainel = autoAplicar({ ...so, fontePeriodo: "painel", meses: 6, energiaInjetadaPeriodo: 700000, painel: { valores: { injetada: 700000 }, meses: 6, fonte: "texto", lidoEm: "" } as never });
    expect(comPainel.injecaoMensalProjetada).toBeNull();
    expect(comPainel.fonteInjecao).toBeNull();
  });
});

describe("leitura adaptativa: IA + layout aprendido", () => {
  // layout fictício de uma distribuidora que as regras não conhecem
  const fatura = (inj: number, saldo: number, mes: string) => [
    "DISTRIBUIDORA EXEMPLO DE ENERGIA S.A.",
    `Mês de referência: ${mes}`,
    `Geração própria entregue à rede (Inj FP) kWh ${inj.toLocaleString("pt-BR")}`,
    "Geração própria entregue à rede (Inj P) kWh 120",
    `Créditos de energia disponíveis (saldo) kWh ${saldo.toLocaleString("pt-BR")}`,
    "Leitura anterior 123456 Leitura atual 125000",
  ];

  it("só aceita da IA números que estão na fatura", async () => {
    const { validarIa } = await import("@/modules/rateio/fatura-ia");
    const v = validarIa({ distribuidora: "EXEMPLO", mesReferencia: "2026-07", injetada: [98765, 120], saldo: [5555], demandaContratada: [999999] }, fatura(98765, 4321, "07/2026"));
    expect(v.componentes.injetada).toEqual([98765, 120]);
    expect(v.componentes.saldo).toBeUndefined();
    expect(v.descartados).toEqual(["saldo", "demandaContratada"]);
  });

  it("aprende o layout com a IA e lê a próxima fatura sem IA", async () => {
    const { lerFaturaTexto, scoreFatura } = await import("@/modules/rateio/fatura");
    const { validarIa, mesclarIa } = await import("@/modules/rateio/fatura-ia");
    const { aprenderLayout } = await import("@/modules/rateio/layout");
    // 1ª fatura: regras não acham a injetada; a IA lê
    const l1 = fatura(98765, 4321, "07/2026");
    const f1 = lerFaturaTexto(l1, "a.pdf");
    expect(Object.keys(f1.injetada)).toHaveLength(0);
    const ia = validarIa({ distribuidora: "EXEMPLO", mesReferencia: "2026-07", injetada: [98765, 120], saldo: [4321] }, l1);
    const f1b = mesclarIa(f1, ia);
    expect(f1b.injetada["2026-07"]).toBe(98885);
    expect(f1b.saldoKwh).toBe(4321);
    expect(f1b.camposIa).toContain("injetada");
    const layout = aprenderLayout(null, "EXEMPLO", l1, ia.componentes, true);
    expect(layout.campos.injetada?.[0]).toHaveLength(2);
    expect(layout.leiturasIa).toBe(1);
    // 2ª fatura, outros números: o layout aprendido lê tudo, sem IA
    const f2 = lerFaturaTexto(fatura(87654, 1234, "08/2026"), "b.pdf", [layout]);
    expect(f2.mesReferencia).toBe("2026-08");
    expect(f2.injetada["2026-08"]).toBe(87774);
    expect(f2.saldoKwh).toBe(1234);
    expect(f2.camposAprendidos).toEqual(expect.arrayContaining(["injetada", "saldo"]));
    expect(f2.distribuidora).toBe("EXEMPLO");
    expect(scoreFatura(f2).score).toBeGreaterThanOrEqual(70);
  });

  it("regras e IA concordando contam como conferência; divergindo, avisam", async () => {
    const { lerFaturaTexto, scoreFatura } = await import("@/modules/rateio/fatura");
    const { validarIa, mesclarIa } = await import("@/modules/rateio/fatura-ia");
    const linhas = ["RGE SUL", "JUL/2026  13/08/2026  R$ 1,00", "Máximo  24.255  kWh Injetado FPonta  124.580", "Mínimo 21.483 kWh Injetado Ponta  7"];
    const f = lerFaturaTexto(linhas, "r.pdf");
    const ok = mesclarIa(f, validarIa({ injetada: [124580, 7] }, linhas));
    expect(ok.conferenciaIa).toBe("ok");
    expect(scoreFatura(ok).itens.some((i) => /Regras e IA leram a mesma/.test(i.texto) && i.ok)).toBe(true);
    const div = mesclarIa(f, validarIa({ injetada: [24255] }, linhas));
    expect(div.conferenciaIa).toBe("divergente");
    expect(div.avisos.some((a) => /confira/.test(a))).toBe(true);
  });

  it("anonimiza documento, instalação, chave e contato antes de mandar para a IA", async () => {
    const { anonimizarFatura } = await import("@/modules/rateio/fatura-ia");
    const out = anonimizarFatura([
      "INSC.EST: 0962780502 / CNPJ: 02.421.421/0007-07",
      "Número da UC 3.523.206.001-62",
      "43260802016440000162660001645246671016561392",
      "contato@exemplo.com.br (49) 3551-5052",
      "kWh Injetado FPonta 124.580",
    ]);
    expect(out.join("\n")).not.toMatch(/02\.421\.421|3\.523\.206\.001-62|4326080201644|exemplo\.com|3551-5052/);
    expect(out).toContain("kWh Injetado FPonta 124.580");
  });
});

describe("recorte do Orange com fatura de 1 mês (RGE)", () => {
  it("aplica Estimada → contratada e Injetada → injetada do período, sem travar a nota", async () => {
    const { autoAplicar } = await import("@/modules/rateio/automacao");
    const { scorePainel } = await import("@/modules/rateio/painel");
    const { usinaVazia } = await import("@/modules/rateio/grid");
    const valores = { estimada: 4389840, injetada: 3239006, compensada: 2708182, saldoInicial: 477803, saldoUtilizado: 15161, saldoVencido: 0, saldoAdicionado: 28074, saldoAcumulado: 490716, geracaoRealizada: 3799256, consumoUsina: 24770, divergencia: -535480, balancoInjetada: 1499343 };
    const painel = { valores, meses: null, fonte: "imagem" as const, lidoEm: "" };
    const umMes = { "2026-07": 124587 };
    const s = scorePainel(painel, umMes);
    expect(s.score).toBeGreaterThanOrEqual(70);
    const u = autoAplicar({ ...usinaVazia("U"), painel, fatura: { injetada: umMes, excedente: {}, consumo: {} } as never });
    expect(u.energiaContratadaPeriodo).toBe(4389840);
    expect(u.energiaInjetadaPeriodo).toBe(3239006);
    expect(u.energiaGeradaPeriodo).toBe(3799256);
    expect(u.fontePeriodo).toBe("painel");
  });
});

describe("período do Orange × fatura de 1 mês", () => {
  it("com os meses informados, usa a média do período e não o mês isolado", async () => {
    const { autoAplicar } = await import("@/modules/rateio/automacao");
    const { injecaoMensal } = await import("@/modules/rateio/engine");
    const { usinaVazia } = await import("@/modules/rateio/grid");
    const fatura = { injetada: { "2026-07": 124587 }, excedente: {}, consumo: { "2026-07": 1330 }, mesReferencia: "2026-07", distribuidora: "RGE", avisos: [], rateio: [], tabelas: [], saldoKwh: null, injetadaMedidor: 124584, arquivo: "", lidaEm: "" };
    const so = autoAplicar({ ...usinaVazia("U"), fatura } as never);
    expect(injecaoMensal(so)).toBe(124587 - 1330);
    const comPeriodo = autoAplicar({ ...so, meses: 6, energiaInjetadaPeriodo: 720000, fontePeriodo: "manual" });
    expect(comPeriodo.injecaoMensalProjetada).toBeNull();
    expect(injecaoMensal(comPeriodo)).toBe(120000);
  });
});
