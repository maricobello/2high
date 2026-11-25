import { describe, expect, it } from "vitest";
import { aplicacaoDaFatura, compararRateio, lerFaturaTexto, mesesEmOperacao, mesIso } from "@/modules/rateio/fatura";
import { checarPainel, lerPainelTexto } from "@/modules/rateio/painel";

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
