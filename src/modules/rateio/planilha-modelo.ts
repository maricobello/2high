/**
 * A planilha modelo do dia a dia ("Análise do Rateio" + "Novas UCs") preenchida pelo
 * sistema: mesmas abas e fórmulas, com os dados da usina, as UCs e as candidatas, mais
 * duas colunas com o rateio proposto pelo sistema e a ação de cada UC.
 */
import type ExcelJS from "exceljs";
import { injecaoMensal } from "./engine";
import type { CandidataAvaliada, Parametros, ResultadoUsina, Usina } from "./types";

async function carregarModelo(): Promise<ExcelJS.Workbook> {
  const [{ MODELO_RATEIO_BASE64 }, mod] = await Promise.all([import("./modelo-base64"), import("exceljs")]);
  const X = (mod as unknown as { default?: typeof ExcelJS }).default ?? (mod as unknown as typeof ExcelJS);
  const bin = atob(MODELO_RATEIO_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const wb = new X.Workbook();
  await wb.xlsx.load(bytes.buffer);
  return wb;
}

/** Modelo em branco, para baixar. */
export async function modeloEmBranco(): Promise<Blob> {
  const { MODELO_RATEIO_BASE64 } = await import("./modelo-base64");
  const bin = atob(MODELO_RATEIO_BASE64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

const PRIMEIRA = 17; // primeira linha de UC no modelo
const ULTIMA_MODELO = 174;
const ACAO = { manter: "Manter", aumentar: "Aumentar", reduzir: "Reduzir", retirar: "Retirar", incluir: "Incluir" } as const;

function data(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  return new Date(`${iso}T12:00:00Z`);
}

export async function preencherModelo(u: Usina, r: ResultadoUsina, candidatas: CandidataAvaliada[], p: Parametros): Promise<Blob> {
  const wb = await carregarModelo();
  const ws = wb.getWorksheet("Análise do Rateio") ?? wb.worksheets[0];

  // --- cabeçalho da usina
  ws.getCell("A3").value = `${r.usinaNome}${u.distribuidora ? ` · ${u.distribuidora}` : ""}${u.fornecedor ? ` · ${u.fornecedor}` : ""}`;
  const ini = data(u.periodoInicio);
  const fim = data(u.periodoFim);
  if (ini) ws.getCell("C4").value = ini;
  if (fim) ws.getCell("D4").value = fim;
  const meses = u.meses || 0;
  if (meses) ws.getCell("C5").value = meses;
  if (u.energiaContratadaPeriodo) ws.getCell("C6").value = u.energiaContratadaPeriodo;
  if (u.energiaGeradaPeriodo) ws.getCell("C7").value = u.energiaGeradaPeriodo;
  // injetada do período; sem ela, usa a injeção do estudo × meses
  const injetada = u.energiaInjetadaPeriodo || (meses ? Math.round(injecaoMensal(u) * meses) : 0);
  if (injetada) ws.getCell("C8").value = injetada;
  ws.getCell("M8").value = p.cobertura;
  ws.getCell("D13").value = Math.round(r.indicadores.compensavelAgregado);
  // consumo mensal (S4:T12, do mês mais recente para o mais antigo)
  const cons = [...u.consumoMensal].reverse().slice(0, 9);
  cons.forEach((c, i) => {
    ws.getCell(4 + i, 19).value = c.mes;
    ws.getCell(4 + i, 20).value = c.kwh;
  });

  // --- UCs atuais (A..J) e fórmulas do modelo (L..Q); estende além da linha 174 se precisar
  const atuais = r.linhas.filter((l) => l.origem === "atual");
  const novas = r.linhas.filter((l) => l.origem === "nova");
  // como na planilha do dia a dia: maior consumo compensável primeiro
  const todas = [...atuais, ...novas].sort((a, b) => b.compensavelKwh - a.compensavelKwh);
  const ultima = Math.max(ULTIMA_MODELO, PRIMEIRA + todas.length - 1);
  const formulas = (n: number): [number, string][] => [
    [12, `IF(G${n}>0,IF($D$10+$D$13>$D$8,G${n}*30%,0),0)`],
    [13, `IF(L${n}>H${n},H${n}*$M$8,H${n}-L${n})`],
    [14, `IFERROR(M${n}/$M$15,0)`],
    [15, `N${n}*$K$16`],
    [16, `IF(G${n}>0,H${n}-O${n},0)`],
    [17, `O${n}+P${n}`],
  ];
  const estilo = (n: number) => ws.getRow(Math.min(n, ULTIMA_MODELO));
  for (let n = ULTIMA_MODELO + 1; n <= ultima; n++) {
    const base = estilo(n);
    const row = ws.getRow(n);
    for (let c = 1; c <= 17; c++) row.getCell(c).style = base.getCell(c).style;
    for (const [c, f] of formulas(n)) row.getCell(c).value = { formula: f };
  }
  for (const [c, col] of [
    [6, "F"],
    [7, "G"],
    [8, "H"],
    [9, "I"],
    [10, "J"],
    [12, "L"],
    [13, "M"],
    [14, "N"],
    [15, "O"],
    [16, "P"],
    [17, "Q"],
  ] as const)
    ws.getCell(15, c).value = { formula: `SUM(${col}${PRIMEIRA}:${col}${ultima})` };

  // colunas do sistema (R e S)
  const cab = ws.getCell(16, 16);
  for (const [c, t] of [
    [18, "Rateio proposto (sistema) %"],
    [19, "Ação"],
  ] as const) {
    const h = ws.getCell(16, c);
    h.value = t;
    h.style = cab.style;
  }
  ws.getColumn(18).width = 16;
  ws.getColumn(19).width = 11;
  const casas = p.casasDecimais > 0 ? `0.${"0".repeat(p.casasDecimais)}` : "0";
  ws.getCell(15, 18).value = { formula: `SUM(R${PRIMEIRA}:R${ultima})` };
  ws.getCell(15, 18).numFmt = casas;

  todas.forEach((l, i) => {
    const n = PRIMEIRA + i;
    const row = ws.getRow(n);
    row.getCell(1).value = l.usina || r.usinaNome;
    row.getCell(2).value = l.idUnidade ? Number(l.idUnidade) || l.idUnidade : null;
    row.getCell(3).value = l.instalacao;
    row.getCell(4).value = l.apelido || null;
    row.getCell(5).value = l.subgrupo || null;
    row.getCell(6).value = l.pctAtual;
    row.getCell(7).value = Math.round(l.saldoKwh);
    row.getCell(8).value = Math.round(l.compensavelKwh * 100) / 100;
    row.getCell(9).value = l.compensavelKwh > 0 ? Math.round((l.saldoKwh / l.compensavelKwh) * 100) / 100 : null;
    row.getCell(10).value = Math.round(l.compensadoKwh * 100) / 100;
    row.getCell(18).value = l.pctProposto;
    row.getCell(18).numFmt = casas;
    row.getCell(19).value = ACAO[l.acao];
  });

  // --- Novas UCs: todas as candidatas avaliadas, com o destino escolhido pelo sistema
  const wn = wb.getWorksheet("Novas UCs");
  if (wn) {
    const lista = [...candidatas].sort((a, b) => Number(b.selecionada) - Number(a.selecionada) || b.candidata.compensavelKwh - a.candidata.compensavelKwh);
    lista.forEach((c, i) => {
      const n = i + 2;
      const row = wn.getRow(n);
      if (n > 237) for (let k = 1; k <= 13; k++) row.getCell(k).style = wn.getRow(237).getCell(k).style;
      row.getCell(1).value = c.candidata.instalacao;
      row.getCell(2).value = c.candidata.apelido || null;
      row.getCell(3).value = c.candidata.concessionaria || null;
      row.getCell(4).value = c.candidata.mesReferencia || null;
      row.getCell(5).value = c.selecionada ? "Incluída" : c.elegivel ? "Reserva" : "Não elegível";
      row.getCell(6).value = c.candidata.ligacaoOriginal || null;
      row.getCell(8).value = c.candidata.mercado || null;
      row.getCell(9).value = c.usinaDestino ?? null;
      row.getCell(10).value = c.candidata.mediaKwh;
      row.getCell(11).value = c.candidata.consumoMinimoKwh;
      row.getCell(12).value = { formula: `J${n}-K${n}` };
      row.getCell(13).value = c.candidata.naUsinaGd || null;
    });
  }

  wb.calcProperties = { ...wb.calcProperties, fullCalcOnLoad: true };
  const bruto = await wb.xlsx.writeBuffer();
  // o exceljs grava "<v>0</v>" junto das fórmulas do modelo; sem esse valor guardado,
  // qualquer programa (Excel, LibreOffice, Google Planilhas) recalcula ao abrir
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(bruto);
  for (const nome of Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
    const xml = await zip.file(nome)!.async("string");
    zip.file(nome, xml.replace(/(<\/f>)<v>[^<]*<\/v>/g, "$1"));
  }
  const buf = await zip.generateAsync({ type: "arraybuffer" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
