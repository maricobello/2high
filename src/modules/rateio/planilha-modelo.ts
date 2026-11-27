/**
 * A planilha modelo do dia a dia ("Análise do Rateio" + "Novas UCs") preenchida pelo
 * sistema: mesmas abas e fórmulas, com os dados da usina, as UCs e as candidatas, mais
 * duas colunas com o rateio proposto pelo sistema e a ação de cada UC.
 */
import type ExcelJS from "exceljs";
import { competencias, estimativaConsumo, resumoConsumo, rotuloCompetencia } from "./consumo";
import { aplicacaoDaFatura } from "./fatura";
import { injecaoMensal } from "./engine";
import { sugerirMaximoPlanilha } from "./otimo-cobertura";
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

export interface CabecalhoModelo {
  inicio: string | null;
  fim: string | null;
  meses: number;
  contratada: number | null;
  gerada: number | null;
  injetada: number | null;
  /** Consumo das UCs por competência (mais antiga → mais recente); estimado = pela planilha de UCs. */
  consumo: { competencia: string; kwh: number; estimado: boolean }[];
}

const fimDoMes = (c: string) => {
  const [a, m] = c.split("-").map(Number);
  return `${c}-${String(new Date(Date.UTC(a, m, 0)).getUTCDate()).padStart(2, "0")}`;
};

/**
 * Cabeçalho do modelo sempre preenchido: o que veio da tela do Orange/planilha manda; o que
 * faltar sai da fatura (período, injetada, gerada = injetada + consumo da usina) e o consumo
 * das UCs sem valor digitado é estimado pela planilha de UCs (compensável + mínimo).
 */
export function cabecalhoModelo(u: Usina): CabecalhoModelo {
  const f = u.fatura ?? null;
  const usados = f ? aplicacaoDaFatura(f).mesesUsados : [];
  const ref = f?.mesReferencia || usados.at(-1) || "";
  const meses = u.meses || usados.length || 0;
  const fimC = /^\d{4}-\d{2}/.test(u.periodoFim ?? "") ? u.periodoFim.slice(0, 7) : /^\d{4}-\d{2}$/.test(ref) ? ref : "";
  const periodo = fimC && meses ? competencias({ periodoInicio: u.periodoInicio, periodoFim: `${fimC}-01`, meses }) : [];
  const inicio = /^\d{4}-\d{2}-\d{2}$/.test(u.periodoInicio ?? "") ? u.periodoInicio : periodo.length ? `${periodo[0]}-01` : null;
  const fim = /^\d{4}-\d{2}-\d{2}$/.test(u.periodoFim ?? "") ? u.periodoFim : fimC ? fimDoMes(fimC) : null;
  // da fatura, só quando ela cobre o período inteiro
  const cobre = f && periodo.length > 0 && periodo.every((c) => (f.injetada[c] ?? 0) > 0);
  const injFatura = cobre ? periodo.reduce((a, c) => a + f.injetada[c], 0) : null;
  const injetada = u.energiaInjetadaPeriodo || injFatura || (meses && injecaoMensal(u) > 0 ? Math.round(injecaoMensal(u) * meses) : null);
  const gerada = u.energiaGeradaPeriodo || (cobre && injFatura ? Math.round(injFatura + periodo.reduce((a, c) => a + Math.max(0, f.consumo[c] ?? 0), 0)) : null);
  const informado = new Map(resumoConsumo({ ...u, periodoInicio: inicio ?? "", periodoFim: fim ?? "", meses }).linhas.filter((l) => l.kwh != null).map((l) => [l.competencia, l.kwh!]));
  const est = Math.round(estimativaConsumo(u));
  const consumo = periodo.length
    ? periodo.map((c) => (informado.has(c) ? { competencia: c, kwh: informado.get(c)!, estimado: false } : { competencia: c, kwh: est, estimado: true })).filter((c) => c.kwh > 0)
    : [...informado.entries()].map(([competencia, kwh]) => ({ competencia, kwh, estimado: false }));
  return { inicio, fim, meses, contratada: u.energiaContratadaPeriodo || null, gerada, injetada, consumo };
}

export async function preencherModelo(u: Usina, r: ResultadoUsina, candidatas: CandidataAvaliada[], p: Parametros): Promise<Blob> {
  const wb = await carregarModelo();
  const ws = wb.getWorksheet("Análise do Rateio") ?? wb.worksheets[0];

  // --- cabeçalho da usina
  ws.getCell("A3").value = `${r.usinaNome}${u.distribuidora ? ` · ${u.distribuidora}` : ""}${u.fornecedor ? ` · ${u.fornecedor}` : ""}`;
  const cabec = cabecalhoModelo(u);
  const ini = cabec.inicio ? data(cabec.inicio) : null;
  const fim = cabec.fim ? data(cabec.fim) : null;
  if (ini) ws.getCell("C4").value = ini;
  if (fim) ws.getCell("D4").value = fim;
  if (cabec.meses) ws.getCell("C5").value = cabec.meses;
  if (cabec.contratada) ws.getCell("C6").value = cabec.contratada;
  else ws.getCell("C6").note = "Falta a energia contratada: envie o recorte do Orange (Estimada) no sistema.";
  if (cabec.gerada) ws.getCell("C7").value = cabec.gerada;
  if (cabec.injetada) ws.getCell("C8").value = cabec.injetada;
  // Máximo Compensável: sempre calculado (sem valor padrão) pelo critério do otimizador
  const sug = sugerirMaximoPlanilha(u, r, p, u.maximoCompensavelPlanilha);
  ws.getCell("M8").value = sug ? sug.cobertura : null;
  const n8 = ws.getCell("N8");
  n8.value = !sug
    ? "não calculado: falta a injeção da usina"
    : `${sug.semEfeito ? "calculado: máx. compensável efetivo do rateio do sistema" : "calculado: ótimo para estas fórmulas"}${u.maximoCompensavelPlanilha != null && Math.abs(u.maximoCompensavelPlanilha - sug.cobertura) > 0.0005 ? ` (antes ${Math.round(u.maximoCompensavelPlanilha * 1000) / 10}%)` : ""}`;
  n8.font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF6B7280" } };
  ws.getCell("D13").value = Math.round(r.indicadores.compensavelAgregado);
  // ultrapassagem de demanda (N4:N6)
  if (u.demanda) {
    if (u.demanda.contratadaKw != null) ws.getCell("N4").value = u.demanda.contratadaKw;
    if (u.demanda.registradaKw != null) ws.getCell("N5").value = u.demanda.registradaKw;
    if (u.demanda.despesaUltrapassagem != null) ws.getCell("N6").value = u.demanda.despesaUltrapassagem;
  }
  // energia consumida no período (S4:T12, da competência mais recente para a mais antiga);
  // mês sem valor digitado vai estimado pela planilha de UCs, marcado ao lado
  const consumo = [...cabec.consumo].reverse();
  consumo.slice(0, 9).forEach((c, i) => {
    ws.getCell(4 + i, 19).value = rotuloCompetencia(c.competencia).toUpperCase();
    ws.getCell(4 + i, 20).value = c.kwh;
    if (c.estimado) {
      const nota = ws.getCell(4 + i, 21);
      nota.value = "estimado (UCs)";
      nota.font = { name: "Calibri", size: 8, italic: true, color: { argb: "FF6B7280" } };
    }
  });
  // o modelo só tem 9 linhas de consumo: com mais competências, o total vai direto em C9
  if (consumo.length > 9) ws.getCell("C9").value = Math.round(consumo.reduce((a, c) => a + c.kwh, 0));

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
