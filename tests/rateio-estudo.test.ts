import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { analisarProjeto } from "@/modules/rateio/engine";
import { exportarEstudo, MARCA_REPLACE } from "@/modules/rateio/estudo-xlsx";
import { exemplo } from "@/modules/rateio/exemplo";
import { PARAMETROS_PADRAO } from "@/modules/rateio/types";

describe("estudo em Excel", () => {
  it("gera folha de estudo e lista de envio por usina, mais os anexos", async () => {
    const ex = exemplo();
    const p = { ...PARAMETROS_PADRAO, metodo: "proporcional" as const, tarifaKwh: 0.8 };
    const r = analisarProjeto(ex.usinas, ex.candidatas, p);
    const blob = await exportarEstudo(ex.usinas, r, p, { marca: { ...MARCA_REPLACE, logo: null, responsavel: "Teste" } });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const nomes = wb.worksheets.map((w) => w.name);
    expect(nomes).toEqual(["Estudo UFV EXEMPLO NORTE", "Anexo I UFV EXEMPLO NORTE", "Envio UFV EXEMPLO NORTE", "Estudo UFV EXEMPLO SUL", "Anexo I UFV EXEMPLO SUL", "Envio UFV EXEMPLO SUL", "Detalhe por UC", "Novas UCs", "Memória de cálculo"]);
    // anexo: uma linha por UC (atuais + novas), totais de 100%
    const anexo = wb.getWorksheet("Anexo I UFV EXEMPLO NORTE")!;
    const ru = r.usinas[0];
    const tot = anexo.getRow(6 + ru.linhas.length + 1);
    expect(tot.getCell(2).value).toBe("TOTAL");
    expect(tot.getCell(5).value).toBeCloseTo(100, 6);
    expect(tot.getCell(6).value).toBeCloseTo(100, 6);
    // ordenado do maior para o menor consumo compensável
    const consumos = Array.from({ length: ru.linhas.length }, (_, k) => anexo.getRow(7 + k).getCell(9).value as number);
    expect(consumos).toEqual([...consumos].sort((a, b) => b - a));
    const estudo = wb.getWorksheet("Estudo UFV EXEMPLO NORTE")!;
    expect(estudo.getCell("A1").value).toBe("REPLACE");
    expect(estudo.getCell("A2").value).toBe("Estudo de rateio de créditos");
    expect(estudo.pageSetup.paperSize).toBe(9);
    // lista de envio soma 100%
    const envio = wb.getWorksheet("Envio UFV EXEMPLO NORTE")!;
    let soma = 0;
    envio.eachRow((row, n) => {
      if (n > 5 && typeof row.getCell(1).value === "number") soma += row.getCell(4).value as number;
    });
    expect(soma).toBeCloseTo(100, 6);
  });

  it("exporta só a usina pedida", async () => {
    const ex = exemplo();
    const p = { ...PARAMETROS_PADRAO, metodo: "proporcional" as const };
    const r = analisarProjeto(ex.usinas, ex.candidatas, p);
    const blob = await exportarEstudo(ex.usinas, r, p, { marca: MARCA_REPLACE as never, usinas: [ex.usinas[1].id] });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name).filter((n) => n.startsWith("Estudo"))).toEqual(["Estudo UFV EXEMPLO SUL"]);
  });
});

describe("planilha modelo", () => {
  it("preenche o modelo com UCs, fórmulas estendidas e a coluna do sistema; modelo em branco não cria usina", async () => {
    const { preencherModelo, modeloEmBranco } = await import("@/modules/rateio/planilha-modelo");
    const { importarSheets } = await import("@/modules/rateio/grid");
    const { lerXlsx } = await import("@/modules/rateio/xlsx");
    const ex = exemplo();
    const p = { ...PARAMETROS_PADRAO, metodo: "proporcional" as const };
    const r = analisarProjeto(ex.usinas, ex.candidatas, p);
    const u = ex.usinas[0];
    const ru = r.usinas[0];
    const blob = await preencherModelo(u, ru, r.candidatas, p);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    const ws = wb.getWorksheet("Análise do Rateio")!;
    expect(ws.getCell("C5").value).toBe(u.meses);
    expect(ws.getCell("R16").value).toBe("Rateio proposto (sistema) %");
    const ultima = 16 + ru.linhas.length;
    // linhas do maior para o menor consumo compensável
    const menor = [...ru.linhas].sort((a, b) => b.compensavelKwh - a.compensavelKwh).at(-1)!;
    expect(ws.getCell(`C${ultima}`).value).toBe(menor.instalacao);
    expect((ws.getCell("H15").value as { formula: string }).formula).toBe(`SUM(H17:H${Math.max(174, ultima)})`);
    // modelo em branco importado não vira usina
    const imp = importarSheets(await lerXlsx(await (await modeloEmBranco()).arrayBuffer()));
    expect(imp.usinas).toHaveLength(0);
  });
});
