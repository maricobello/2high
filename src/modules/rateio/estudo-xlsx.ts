/**
 * Estudo de rateio em Excel, no formato "prontuário": uma folha de estudo por usina,
 * que se lê em segundos, mais a lista para envio à distribuidora e os anexos.
 * Gerado no navegador (exceljs carregado sob demanda).
 */
import { coberturaEfetiva, sugerirMaximoPlanilha } from "./otimo-cobertura";
import { resumoConsumo } from "./consumo";
import type ExcelJS from "exceljs";
import { injecaoMensal } from "./engine";
import { ACAO_LABEL, atencaoEstudo, AVISO_ESTIMATIVA, condutaEstudo, fmt, identificacao, kpisEstudo, LEGENDA_SITUACAO, linhasAnexo, protocoloEstudo, resumoAnexo, subtituloUsina, veredito } from "./estudo-dados";
import { aplicacaoDaFatura, scoreFatura } from "./fatura";
import { METODOLOGIA } from "./metodologia";
import { scorePainel } from "./painel";
import type { Acao, Parametros, ResultadoProjeto, ResultadoUsina, Usina } from "./types";

export interface MarcaEstudo {
  /** Nome que assina o estudo (ex.: a empresa que faz a análise). */
  empresa: string;
  /** Cor principal em hex (#RRGGBB). */
  cor: string;
  /** Logo em data URL (PNG ou JPEG). */
  logo: string | null;
  /** Nome do responsável técnico, para o campo de assinatura. */
  responsavel: string;
}

export const MARCA_PADRAO: MarcaEstudo = { empresa: "", cor: "#1F3A5F", logo: null, responsavel: "" };
/** Identidade da Replace (laranja e cinza do logo). O logo é enviado pelo usuário. */
export const MARCA_REPLACE: Omit<MarcaEstudo, "logo" | "responsavel"> = { empresa: "Replace", cor: "#E5791C" };

export interface OpcoesEstudo {
  marca: MarcaEstudo;
  pareceres?: Record<string, string>;
  /** Exporta só estas usinas (ids). Vazio = todas. */
  usinas?: string[];
  /** Ciclo/mês de referência para o cabeçalho (ex.: "11/2026"). */
  ciclo?: Record<string, string>;
}

async function lib(): Promise<typeof ExcelJS> {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof ExcelJS }).default ?? (mod as unknown as typeof ExcelJS);
}

// ---------------------------------------------------------------------------
// Paleta (papel branco, uma cor de marca, cinzas e sinais discretos)

const argb = (hex: string) => `FF${hex.replace("#", "").toUpperCase().padStart(6, "0").slice(-6)}`;
function tom(hex: string, branco: number): string {
  const h = hex.replace("#", "");
  const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  const m = c.map((v) => Math.round(v + (255 - v) * branco));
  return `FF${m.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
function escuro(hex: string, preto: number): string {
  const h = hex.replace("#", "");
  const m = [0, 2, 4].map((i) => Math.round((parseInt(h.slice(i, i + 2), 16) || 0) * (1 - preto)));
  return `FF${m.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}
const TXT = "FF1F2937";
/** Fundo dos cabeçalhos de tabela: grafite (texto branco legível com qualquer cor de marca). */
const GRAFITE = "FF3F3F46";
const MUDO = "FF6B7280";
const LINHA = "FFE5E7EB";
const FUNDO = "FFF9FAFB";
const OK = "FF15803D";
const ERRO = "FFB91C1C";
const ATENCAO = "FFB45309";

const ACAO_COR: Record<Acao, string> = { manter: MUDO, aumentar: OK, reduzir: ATENCAO, retirar: ERRO, incluir: "FF1D4ED8" };

const KWH = "#,##0";
const nomeAba = (s: string) => s.replace(/[\\/?*[\]:]/g, "").slice(0, 31);

function borda(cor = LINHA): Partial<ExcelJS.Borders> {
  const b = { style: "thin" as const, color: { argb: cor } };
  return { top: b, bottom: b, left: b, right: b };
}

function paginaRetrato(ws: ExcelJS.Worksheet, marca: MarcaEstudo, titulo: string, paisagem = false) {
  ws.views = [{ showGridLines: false }];
  ws.pageSetup = {
    paperSize: 9,
    orientation: paisagem ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    margins: { left: 0.45, right: 0.45, top: 0.55, bottom: 0.6, header: 0.25, footer: 0.3 },
  };
  const quem = marca.empresa ? `${marca.empresa} · ` : "";
  ws.headerFooter = {
    oddFooter: `&L&8&K6B7280${quem}${titulo}&R&8&K6B7280Página &P de &N`,
  };
}

// ---------------------------------------------------------------------------

export async function exportarEstudo(usinas: Usina[], resultado: ResultadoProjeto, p: Parametros, opcoes: OpcoesEstudo): Promise<Blob> {
  const X = await lib();
  const wb = new X.Workbook();
  const marca = { ...MARCA_PADRAO, ...opcoes.marca };
  const cor = /^#?[0-9a-f]{6}$/i.test(marca.cor) ? (marca.cor.startsWith("#") ? marca.cor : `#${marca.cor}`) : MARCA_PADRAO.cor;
  // marca: faixas e fundos; texto: a cor da marca escurecida para leitura em papel branco
  const C = { marca: argb(cor), claro: tom(cor, 0.92), medio: tom(cor, 0.7), texto: escuro(cor, 0.22) };
  wb.creator = marca.empresa || "Estudo de rateio";
  wb.created = new Date();

  const alvo = resultado.usinas.filter((r) => !opcoes.usinas?.length || opcoes.usinas.includes(r.usinaId));
  let logoId: number | null = null;
  if (marca.logo && /^data:image\/(png|jpe?g);base64,/.test(marca.logo)) {
    const ext = marca.logo.startsWith("data:image/png") ? "png" : "jpeg";
    logoId = wb.addImage({ base64: marca.logo, extension: ext });
  }
  const hoje = new Date();
  const emissao = hoje.toLocaleDateString("pt-BR");

  for (const r of alvo) {
    const u = usinas.find((x) => x.id === r.usinaId)!;
    folhaEstudo(wb, u, r, p, marca, C, logoId, emissao, opcoes.pareceres?.[r.usinaId], opcoes.ciclo?.[r.usinaId], resultado.metodo);
    folhaAnexo(wb, u, r, p, marca, C, emissao);
    folhaEnvio(wb, u, r, p, marca, C, emissao);
  }
  folhaDetalhe(wb, alvo, p, marca, C);
  folhaNovas(wb, resultado, alvo, marca, C);
  folhaMemoria(wb, usinas, alvo, p, marca, C, resultado.metodo);

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

type Cores = { marca: string; claro: string; medio: string; texto: string };

// ---------------------------------------------------------------------------
// Folha principal: o "prontuário" da usina

function folhaEstudo(
  wb: ExcelJS.Workbook,
  u: Usina,
  r: ResultadoUsina,
  p: Parametros,
  marca: MarcaEstudo,
  C: Cores,
  logoId: number | null,
  emissao: string,
  parecer: string | undefined,
  ciclo: string | undefined,
  metodo: ResultadoProjeto["metodo"],
) {
  const ws = wb.addWorksheet(nomeAba(`Estudo ${r.usinaNome}`), { properties: { tabColor: { argb: C.marca } } });
  paginaRetrato(ws, marca, `Estudo de rateio · ${r.usinaNome}`);
  // 8 colunas de largura igual: grade simples para blocos de 2 e 4 colunas
  ws.columns = Array.from({ length: 8 }, () => ({ width: 13.5 }));
  let row = 1;
  const font = (o: Partial<ExcelJS.Font> = {}): Partial<ExcelJS.Font> => ({ name: "Calibri", size: 10, color: { argb: TXT }, ...o });

  const celula = (r1: number, c1: number, r2: number, c2: number, valor: ExcelJS.CellValue, estilo: { font?: Partial<ExcelJS.Font>; fill?: string; align?: Partial<ExcelJS.Alignment>; borda?: boolean; fmt?: string } = {}) => {
    if (r2 > r1 || c2 > c1) ws.mergeCells(r1, c1, r2, c2);
    const c = ws.getCell(r1, c1);
    c.value = valor;
    c.font = font(estilo.font);
    c.alignment = { vertical: "middle", wrapText: true, ...estilo.align };
    if (estilo.fill) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: estilo.fill } };
    if (estilo.borda) c.border = borda();
    if (estilo.fmt) c.numFmt = estilo.fmt;
    return c;
  };

  // --- Cabeçalho
  ws.getRow(1).height = 22;
  ws.getRow(2).height = 26;
  ws.getRow(3).height = 18;
  const iniTitulo = logoId != null ? 3 : 1;
  if (logoId != null) ws.addImage(logoId, { tl: { col: 0.1, row: 0.2 }, ext: { width: 150, height: 52 }, editAs: "oneCell" });
  celula(1, iniTitulo, 1, 5, marca.empresa ? marca.empresa.toUpperCase() : "ESTUDO TÉCNICO", { font: { size: 9, bold: true, color: { argb: C.texto } } });
  celula(2, iniTitulo, 2, 5, "Estudo de rateio de créditos", { font: { size: 17, bold: true } });
  celula(3, iniTitulo, 3, 5, subtituloUsina(u, r), { font: { size: 11, color: { argb: MUDO } }, align: { wrapText: false, shrinkToFit: true } });
  const protocolo = protocoloEstudo(r.usinaNome, emissao);
  [
    ["Protocolo", protocolo],
    ["Emissão", emissao],
    ["Ciclo", ciclo || "—"],
  ].forEach(([k, v], i) => {
    celula(1 + i, 6, 1 + i, 6, k, { font: { size: 8, color: { argb: MUDO } }, align: { horizontal: "right" } });
    celula(1 + i, 7, 1 + i, 8, v, { font: { size: 9, bold: true }, align: { horizontal: "right" } });
  });
  row = 4;
  ws.getRow(row).height = 6;
  for (let c = 1; c <= 8; c++) ws.getCell(row, c).border = { bottom: { style: "medium", color: { argb: C.marca } } };
  row += 2;

  const secao = (n: number, titulo: string) => {
    ws.getRow(row).height = 20;
    celula(row, 1, row, 8, `${n}. ${titulo.toUpperCase()}`, { font: { size: 10, bold: true, color: { argb: C.texto } } });
    for (let c = 1; c <= 8; c++) ws.getCell(row, c).border = { bottom: { style: "thin", color: { argb: C.medio } } };
    row += 1;
  };

  // --- 1. Identificação
  secao(1, "Identificação");
  const ident = identificacao(u, r, metodo);
  for (let k = 0; k < ident.length; k += 2) {
    ws.getRow(row).height = 18;
    ident.slice(k, k + 2).forEach(([lab, val], j) => {
      const c0 = j * 4 + 1;
      celula(row, c0, row, c0, lab, { font: { size: 9, color: { argb: MUDO } } });
      celula(row, c0 + 1, row, c0 + 3, val, { font: { size: 10, bold: true } });
    });
    row++;
  }
  row++;

  // --- 2. Resultado (4 números)
  secao(2, `Resultado esperado em ${p.mesesSimulacao} meses`);
  const kpis = kpisEstudo(r, p);
  ws.getRow(row).height = 16;
  ws.getRow(row + 1).height = 26;
  ws.getRow(row + 2).height = 16;
  kpis.forEach((k, j) => {
    const c0 = j * 2 + 1;
    celula(row, c0, row, c0 + 1, k.titulo, { font: { size: 8, bold: true, color: { argb: MUDO } }, fill: C.claro, align: { horizontal: "center" } });
    celula(row + 1, c0, row + 1, c0 + 1, k.valor, { font: { size: 14, bold: true, color: { argb: k.destaque ? C.texto : TXT } }, fill: C.claro, align: { horizontal: "center" } });
    celula(row + 2, c0, row + 2, c0 + 1, k.nota, { font: { size: 8, color: { argb: MUDO } }, fill: C.claro, align: { horizontal: "center" } });
  });
  row += 4;

  // --- 3. Conduta
  secao(3, "Conduta (o que muda no rateio)");
  const cab = (cols: [number, number, string][]) => {
    ws.getRow(row).height = 18;
    cols.forEach(([c1, c2, t]) => celula(row, c1, row, c2, t, { font: { size: 8, bold: true, color: { argb: MUDO } }, fill: FUNDO, borda: true }));
    row++;
  };
  cab([
    [1, 2, "Ação"],
    [3, 3, "UCs"],
    [4, 8, "O que significa"],
  ]);
  for (const { acao: a, n, efeito } of condutaEstudo(r)) {
    ws.getRow(row).height = 18;
    celula(row, 1, row, 2, ACAO_LABEL[a], { font: { bold: true, color: { argb: ACAO_COR[a] } }, borda: true });
    celula(row, 3, row, 3, n, { font: { bold: true }, borda: true, align: { horizontal: "center" } });
    celula(row, 4, row, 8, efeito, { font: { color: { argb: MUDO } }, borda: true });
    row++;
  }
  celula(row, 1, row, 8, `UC por UC no Anexo I (aba "${nomeAba(`Anexo I ${r.usinaNome}`)}"); lista para a distribuidora na aba "${nomeAba(`Envio ${r.usinaNome}`)}"; motivo de cada UC em "Detalhe por UC".`, { font: { size: 8, italic: true, color: { argb: MUDO } } });
  row += 2;

  // --- 4. Validação
  secao(4, "Validação antes do envio");
  const ver = veredito(r);
  ws.getRow(row).height = 20;
  celula(row, 1, row, 8, ver.texto, {
    font: { bold: true, color: { argb: ver.nivel === "erro" ? ERRO : ver.nivel === "aviso" ? ATENCAO : OK } },
    fill: ver.nivel === "erro" ? "FFFEF2F2" : ver.nivel === "aviso" ? "FFFFFBEB" : "FFF0FDF4",
    align: { indent: 1 },
  });
  row++;
  for (const v of r.validacoes) {
    ws.getRow(row).height = 17;
    celula(row, 1, row, 1, v.ok ? "✓" : v.nivel === "erro" ? "✗" : "!", { font: { bold: true, color: { argb: v.ok ? OK : v.nivel === "erro" ? ERRO : ATENCAO } }, align: { horizontal: "center" } });
    celula(row, 2, row, 5, v.titulo, { font: { size: 9 } });
    celula(row, 6, row, 8, v.detalhe, { font: { size: 8, color: { argb: MUDO } } });
    row++;
  }
  row++;

  // --- 5. Atenção
  const atencao = atencaoEstudo(r);
  if (atencao.length) {
    secao(5, "Pontos de atenção");
    for (const a of atencao) {
      const altura = Math.min(48, 16 + Math.floor(a.detalhe.length / 120) * 12);
      ws.getRow(row).height = altura;
      celula(row, 1, row, 1, a.severidade === "alta" ? "●" : "○", { font: { color: { argb: a.severidade === "alta" ? ERRO : ATENCAO } }, align: { horizontal: "center", vertical: "top" } });
      celula(row, 2, row, 8, { richText: [{ text: `${a.titulo}. `, font: font({ size: 9, bold: true }) }, { text: a.detalhe, font: font({ size: 9, color: { argb: MUDO } }) }] }, { align: { vertical: "top" } });
      row++;
    }
    row++;
  }

  // --- 6. Parecer
  if (parecer?.trim()) {
    // página 1 = resumo; parecer e assinaturas na página 2 (como uma folha de laudo)
    ws.getRow(row - 1).addPageBreak();
    secao(atencao.length ? 6 : 5, "Parecer técnico");
    // altura pela quantidade de linhas: ~135 caracteres por linha na largura da folha
    const linhas = parecer
      .trim()
      .split("\n")
      .reduce((a, par) => a + Math.max(1, Math.ceil(par.length / 135)), 0);
    ws.getRow(row).height = Math.min(409, Math.max(30, linhas * 12.5 + 6));
    celula(row, 1, row, 8, parecer.trim(), { font: { size: 9.5 }, align: { vertical: "top" } });
    row += 2;
  }

  // --- Assinaturas
  row++;
  ws.getRow(row).height = 30;
  for (const [c1, c2] of [
    [1, 4],
    [6, 8],
  ])
    for (let c = c1; c <= c2; c++) ws.getCell(row, c).border = { bottom: { style: "thin", color: { argb: TXT } } };
  row++;
  celula(row, 1, row, 4, `Responsável técnico${marca.responsavel ? `: ${marca.responsavel}` : ""}`, { font: { size: 8, color: { argb: MUDO } } });
  celula(row, 6, row, 8, "De acordo (cliente / fornecedor)", { font: { size: 8, color: { argb: MUDO } } });
  row += 2;
  celula(row, 1, row, 8, AVISO_ESTIMATIVA, {
    font: { size: 7.5, italic: true, color: { argb: MUDO } },
  });
  ws.getRow(row).height = 22;
  ws.pageSetup.printArea = `A1:H${row}`;
}

// ---------------------------------------------------------------------------
// Anexo I: as UCs no rateio, hoje e como ficam

function folhaAnexo(wb: ExcelJS.Workbook, u: Usina, r: ResultadoUsina, p: Parametros, marca: MarcaEstudo, C: Cores, emissao: string) {
  const ws = wb.addWorksheet(nomeAba(`Anexo I ${r.usinaNome}`), { properties: { tabColor: { argb: C.marca } } });
  paginaRetrato(ws, marca, `Anexo I · UCs no rateio · ${r.usinaNome}`);
  const pctFmt = p.casasDecimais > 0 ? `0.${"0".repeat(p.casasDecimais)}` : "0";
  const varFmt = p.casasDecimais > 0 ? `+0.${"0".repeat(p.casasDecimais)};-0.${"0".repeat(p.casasDecimais)};0` : "+0;-0;0";
  const cols: { t: string; w: number; fmt?: string; dir?: boolean; centro?: boolean }[] = [
    { t: "Nº", w: 5, centro: true },
    { t: "UC (instalação)", w: 17 },
    { t: "Apelido", w: 13 },
    { t: "Situação hoje", w: 13 },
    { t: "% atual", w: 8, fmt: pctFmt, dir: true },
    { t: "% proposto", w: 9, fmt: pctFmt, dir: true },
    { t: "Variação (p.p.)", w: 9, fmt: varFmt, dir: true },
    { t: "Ação", w: 9 },
    { t: "Consumo compensável (kWh/mês)", w: 12, fmt: KWH, dir: true },
    { t: "Saldo hoje (meses)", w: 9, fmt: "0.0", dir: true },
  ];
  ws.columns = cols.map((c) => ({ width: c.w }));
  const n = cols.length;

  // cabeçalho do anexo
  ws.mergeCells(1, 1, 1, n);
  ws.getCell(1, 1).value = `${marca.empresa ? `${marca.empresa.toUpperCase()} · ` : ""}ANEXO I`;
  ws.getCell(1, 1).font = { name: "Calibri", size: 9, bold: true, color: { argb: C.texto } };
  ws.mergeCells(2, 1, 2, n);
  ws.getCell(2, 1).value = `UCs no rateio · ${r.usinaNome}`;
  ws.getCell(2, 1).font = { name: "Calibri", size: 15, bold: true, color: { argb: TXT } };
  const f = 10 ** p.casasDecimais;
  const soma = (k: "pctAtual" | "pctProposto") => Math.round(r.linhas.reduce((a, l) => a + l[k], 0) * f) / f;
  ws.mergeCells(3, 1, 3, n);
  ws.getCell(3, 1).value = resumoAnexo(u, r, p, emissao);
  ws.getCell(3, 1).font = { name: "Calibri", size: 9.5, color: { argb: MUDO } };
  ws.getCell(3, 1).alignment = { wrapText: false, shrinkToFit: true };
  for (let c = 1; c <= n; c++) ws.getCell(4, c).border = { bottom: { style: "medium", color: { argb: C.marca } } };
  ws.getRow(4).height = 6;

  const H = 6;
  const h = ws.getRow(H);
  h.values = cols.map((c) => c.t);
  h.height = 30;
  h.eachCell((c, k) => {
    c.font = { name: "Calibri", size: 8.5, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAFITE } };
    c.border = { bottom: { style: "medium", color: { argb: C.marca } } };
    c.alignment = { vertical: "middle", wrapText: true, horizontal: cols[k - 1].dir ? "right" : cols[k - 1].centro ? "center" : "left", indent: k === 8 ? 1 : 0 };
  });

  // do maior para o menor consumo compensável (quem mais pesa no rateio primeiro)
  const ordenadas = linhasAnexo(r);
  ordenadas.forEach((l, k) => {
    const row = ws.addRow([k + 1, l.instalacao, l.apelido || "—", l.diagnostico.rotulo, l.pctAtual, l.pctProposto, l.pctProposto - l.pctAtual, ACAO_LABEL[l.acao], l.compensavelKwh, l.origem === "nova" ? null : l.mesesSaldoHoje]);
    row.height = 15;
    row.eachCell({ includeEmpty: true }, (c, i) => {
      const col = cols[i - 1];
      c.font = { name: "Calibri", size: 8.5, color: { argb: TXT } };
      if (col.fmt) c.numFmt = col.fmt;
      c.alignment = { vertical: "middle", horizontal: col.dir ? "right" : col.centro ? "center" : "left" };
      c.border = { bottom: { style: "hair", color: { argb: LINHA } } };
      if (k % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FUNDO } };
    });
    row.getCell(1).font = { name: "Calibri", size: 8, color: { argb: MUDO } };
    row.getCell(6).font = { name: "Calibri", size: 8.5, bold: true, color: { argb: TXT } };
    const d = l.pctProposto - l.pctAtual;
    row.getCell(7).font = { name: "Calibri", size: 8.5, color: { argb: Math.abs(d) < 10 ** -p.casasDecimais / 2 ? MUDO : d > 0 ? OK : ATENCAO } };
    row.getCell(8).font = { name: "Calibri", size: 8.5, bold: true, color: { argb: ACAO_COR[l.acao] } };
    row.getCell(8).alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  });

  // barra no consumo: o tamanho de cada UC de relance
  if (ordenadas.length)
    ws.addConditionalFormatting({
      ref: `I${H + 1}:I${H + ordenadas.length}`,
      rules: [{ type: "dataBar", priority: 1, gradient: false, minLength: 0, maxLength: 100, cfvo: [{ type: "num", value: 0 }, { type: "max" }], color: { argb: C.medio } } as unknown as ExcelJS.ConditionalFormattingRule],
    });
  const tot = ws.addRow(["", "TOTAL", "", "", soma("pctAtual"), soma("pctProposto"), null, "", r.linhas.reduce((a, l) => a + Math.max(0, l.compensavelKwh), 0), null]);
  tot.eachCell({ includeEmpty: true }, (c, i) => {
    const col = cols[i - 1];
    c.font = { name: "Calibri", size: 9, bold: true, color: { argb: TXT } };
    if (col.fmt) c.numFmt = col.fmt;
    c.alignment = { horizontal: col.dir ? "right" : "left" };
    c.border = { top: { style: "medium", color: { argb: C.marca } } };
  });
  const leg = ws.addRow([]);
  ws.mergeCells(leg.number + 1, 1, leg.number + 1, n);
  const nota = ws.getCell(leg.number + 1, 1);
  nota.value = LEGENDA_SITUACAO;
  nota.font = { name: "Calibri", size: 7.5, italic: true, color: { argb: MUDO } };
  nota.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(leg.number + 1).height = 24;

  ws.views = [{ showGridLines: false, state: "frozen", ySplit: H }];
  ws.autoFilter = { from: { row: H, column: 1 }, to: { row: H, column: n } };
  ws.pageSetup.printTitlesRow = `${H}:${H}`;
}

// ---------------------------------------------------------------------------
// Lista para envio à distribuidora

function folhaEnvio(wb: ExcelJS.Workbook, u: Usina, r: ResultadoUsina, p: Parametros, marca: MarcaEstudo, C: Cores, emissao: string) {
  const ws = wb.addWorksheet(nomeAba(`Envio ${r.usinaNome}`), { properties: { tabColor: { argb: C.medio } } });
  paginaRetrato(ws, marca, `Lista de rateio · ${r.usinaNome}`);
  ws.columns = [{ width: 7 }, { width: 24 }, { width: 22 }, { width: 16 }];
  const pctFmt = p.casasDecimais > 0 ? `0.${"0".repeat(p.casasDecimais)}` : "0";
  const t = ws.getCell("A1");
  ws.mergeCells("A1:D1");
  t.value = "Lista de rateio para envio";
  t.font = { name: "Calibri", size: 15, bold: true, color: { argb: TXT } };
  ws.mergeCells("A2:D2");
  ws.getCell("A2").value = `${r.usinaNome}${u.distribuidora ? ` · ${u.distribuidora}` : ""} · emitida em ${emissao}`;
  ws.getCell("A2").font = { name: "Calibri", size: 10, color: { argb: MUDO } };
  const ativas = r.linhas.filter((l) => l.pctProposto > 0).sort((a, b) => b.pctProposto - a.pctProposto);
  const f = 10 ** p.casasDecimais;
  const soma = Math.round(ativas.reduce((a, l) => a + l.pctProposto, 0) * f) / f;
  ws.mergeCells("A3:D3");
  ws.getCell("A3").value = `${ativas.length} unidades consumidoras · soma ${fmt(soma, p.casasDecimais)}%`;
  ws.getCell("A3").font = { name: "Calibri", size: 10, bold: true, color: { argb: soma === 100 ? OK : ERRO } };
  const h = ws.getRow(5);
  h.values = ["Nº", "Nº da instalação (UC)", "Apelido", "Percentual (%)"];
  h.height = 20;
  h.eachCell((c, n) => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAFITE } };
    c.border = { bottom: { style: "medium", color: { argb: C.marca } } };
    c.alignment = { vertical: "middle", horizontal: n === 4 ? "right" : n === 1 ? "center" : "left" };
  });
  ativas.forEach((l, k) => {
    const row = ws.addRow([k + 1, l.instalacao, l.apelido || "—", l.pctProposto]);
    row.getCell(4).numFmt = pctFmt;
    row.getCell(1).alignment = { horizontal: "center" };
    row.eachCell((c) => {
      c.font = { name: "Calibri", size: 10, color: { argb: TXT } };
      c.border = { bottom: { style: "hair", color: { argb: LINHA } } };
      if (k % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FUNDO } };
    });
  });
  const tot = ws.addRow(["", "TOTAL", "", soma]);
  tot.getCell(4).numFmt = pctFmt;
  tot.eachCell((c) => {
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: TXT } };
    c.border = { top: { style: "medium", color: { argb: C.marca } } };
  });
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 5 }];
  ws.pageSetup.printTitlesRow = "5:5";
}

// ---------------------------------------------------------------------------
// Tabelas de apoio

function tabela(ws: ExcelJS.Worksheet, C: Cores, colunas: { titulo: string; largura: number; fmt?: string; direita?: boolean }[], linhaCab = 1) {
  ws.columns = colunas.map((c) => ({ width: c.largura, style: c.fmt ? { numFmt: c.fmt } : {} }));
  const h = ws.getRow(linhaCab);
  h.values = colunas.map((c) => c.titulo);
  h.height = 30;
  h.eachCell((c, n) => {
    c.font = { name: "Calibri", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GRAFITE } };
    c.border = { bottom: { style: "medium", color: { argb: C.marca } } };
    c.alignment = { vertical: "middle", wrapText: true, horizontal: colunas[n - 1].direita ? "right" : "left" };
  });
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: linhaCab }];
  ws.autoFilter = { from: { row: linhaCab, column: 1 }, to: { row: linhaCab, column: colunas.length } };
  ws.pageSetup.printTitlesRow = `${linhaCab}:${linhaCab}`;
}

function zebra(row: ExcelJS.Row, k: number) {
  row.eachCell({ includeEmpty: true }, (c) => {
    c.font = { name: "Calibri", size: 9, color: { argb: TXT }, ...(c.font ?? {}) };
    c.border = { bottom: { style: "hair", color: { argb: LINHA } } };
    if (k % 2) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FUNDO } };
    c.alignment = { vertical: "top", wrapText: true, ...(c.alignment ?? {}) };
  });
}

function folhaDetalhe(wb: ExcelJS.Workbook, alvo: ResultadoUsina[], p: Parametros, marca: MarcaEstudo, C: Cores) {
  const ws = wb.addWorksheet("Detalhe por UC");
  paginaRetrato(ws, marca, "Detalhe por UC", true);
  const pctFmt = p.casasDecimais > 0 ? `0.${"0".repeat(p.casasDecimais)}` : "0";
  tabela(ws, C, [
    { titulo: "Usina", largura: 16 },
    { titulo: "UC (instalação)", largura: 18 },
    { titulo: "Apelido", largura: 14 },
    { titulo: "Situação hoje", largura: 14 },
    { titulo: "Ação", largura: 10 },
    { titulo: "% atual", largura: 9, fmt: pctFmt, direita: true },
    { titulo: "% proposto", largura: 10, fmt: pctFmt, direita: true },
    { titulo: "Consumo compensável (kWh/mês)", largura: 13, fmt: KWH, direita: true },
    { titulo: "Saldo hoje (meses)", largura: 10, fmt: "0.0", direita: true },
    { titulo: "Saldo no fim (meses)", largura: 10, fmt: "0.0", direita: true },
    { titulo: "Motivo", largura: 62 },
  ]);
  let k = 0;
  for (const r of alvo) {
    for (const l of [...r.linhas].sort((a, b) => b.compensavelKwh - a.compensavelKwh || b.pctProposto - a.pctProposto)) {
      const row = ws.addRow([r.usinaNome, l.instalacao, l.apelido, l.diagnostico.rotulo, ACAO_LABEL[l.acao], l.pctAtual, l.pctProposto, l.compensavelKwh, l.mesesSaldoHoje, l.mesesSaldoFimProposto, l.motivo]);
      zebra(row, k++);
      row.getCell(5).font = { name: "Calibri", size: 9, bold: true, color: { argb: ACAO_COR[l.acao] } };
      row.getCell(7).font = { name: "Calibri", size: 9, bold: true, color: { argb: TXT } };
    }
  }
}

function folhaNovas(wb: ExcelJS.Workbook, resultado: ResultadoProjeto, alvo: ResultadoUsina[], marca: MarcaEstudo, C: Cores) {
  if (!resultado.candidatas.length) return;
  const nomes = new Set(alvo.map((r) => r.usinaNome));
  const ws = wb.addWorksheet("Novas UCs");
  paginaRetrato(ws, marca, "Novas UCs avaliadas", true);
  tabela(ws, C, [
    { titulo: "Resultado", largura: 12 },
    { titulo: "Usina destino", largura: 16 },
    { titulo: "UC (instalação)", largura: 18 },
    { titulo: "Endereço ID", largura: 16 },
    { titulo: "Ligação", largura: 12 },
    { titulo: "Média (kWh)", largura: 11, fmt: KWH, direita: true },
    { titulo: "Compensável (kWh/mês)", largura: 13, fmt: KWH, direita: true },
    { titulo: "Motivo", largura: 60 },
  ]);
  const lista = [...resultado.candidatas]
    .filter((c) => !c.selecionada || (c.usinaDestino && nomes.has(c.usinaDestino)))
    .sort((a, b) => Number(b.selecionada) - Number(a.selecionada) || Number(b.elegivel) - Number(a.elegivel) || b.candidata.compensavelKwh - a.candidata.compensavelKwh);
  lista.forEach((c, k) => {
    const res = c.selecionada ? "Incluída" : c.elegivel ? "Reserva" : "Não elegível";
    const row = ws.addRow([res, c.usinaDestino ?? "", c.candidata.instalacao, c.candidata.apelido, c.candidata.ligacaoOriginal, c.candidata.mediaKwh, c.candidata.compensavelKwh, c.motivo]);
    zebra(row, k);
    row.getCell(1).font = { name: "Calibri", size: 9, bold: true, color: { argb: c.selecionada ? OK : c.elegivel ? MUDO : ERRO } };
  });
}

function folhaMemoria(wb: ExcelJS.Workbook, usinas: Usina[], alvo: ResultadoUsina[], p: Parametros, marca: MarcaEstudo, C: Cores, metodo: ResultadoProjeto["metodo"]) {
  const ws = wb.addWorksheet("Memória de cálculo");
  paginaRetrato(ws, marca, "Memória de cálculo");
  ws.columns = [{ width: 34 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 }];
  let row = 1;
  const titulo = (t: string) => {
    ws.mergeCells(row, 1, row, 6);
    const c = ws.getCell(row, 1);
    c.value = t.toUpperCase();
    c.font = { name: "Calibri", size: 10, bold: true, color: { argb: C.texto } };
    for (let k = 1; k <= 6; k++) ws.getCell(row, k).border = { bottom: { style: "thin", color: { argb: C.medio } } };
    row += 1;
  };
  const par = (k: string, v: string) => {
    ws.getCell(row, 1).value = k;
    ws.getCell(row, 1).font = { name: "Calibri", size: 9, color: { argb: MUDO } };
    ws.mergeCells(row, 2, row, 6);
    ws.getCell(row, 2).value = v;
    ws.getCell(row, 2).font = { name: "Calibri", size: 9, bold: true, color: { argb: TXT } };
    row++;
  };
  ws.views = [{ showGridLines: false }];

  titulo("Parâmetros");
  par("Método", metodo === "otimizado" ? "Otimização matemática (programação linear inteira, solver HiGHS)" : "Regra proporcional à necessidade");
  par("Máximo compensável", metodo === "otimizado" ? "Livre por UC: o modelo escolhe o percentual que compensa mais energia" : `${fmt(p.cobertura * 100)}% do consumo compensável`);
  par("Horizonte para usar o saldo / reserva", `${p.horizonteSaldoMeses} meses / ${fmt(p.reservaSaldoMeses, 1)} mês de consumo`);
  par("Casas decimais / mínimo por UC", `${p.casasDecimais} / ${fmt(p.pctMinimo, p.casasDecimais)}%`);
  par("Projeção / cenário de estresse", `${p.mesesSimulacao} meses / consumo ${fmt(p.fatorConsumoEstresse * 100)}%`);
  if (p.tarifaKwh > 0) par("Tarifa média das UCs", `${fmt(p.tarifaKwh, 2)} R$/kWh`);
  const valores = Object.entries(p.valorKwhSubgrupo ?? {}).filter(([, v]) => v > 0);
  if (valores.length) par("Valor do kWh por subgrupo (objetivo em R$)", valores.map(([k, v]) => `${k} ${fmt(v, 2)}`).join(" · "));
  if (metodo === "otimizado") par("Refino", "Ótimo exato na grade de percentuais da distribuidora (trocas de 1% até a última casa decimal)");
  row++;

  for (const r of alvo) {
    const u = usinas.find((x) => x.id === r.usinaId)!;
    titulo(`Fontes · ${r.usinaNome}`);
    par("Energia para rateio usada", `${fmt(injecaoMensal(u))} kWh/mês`);
    const efAt = coberturaEfetiva(r, "atual");
    const efPr = coberturaEfetiva(r, "proposto");
    if (efPr != null) par("Máximo compensável efetivo (atual → proposto)", `${efAt == null ? "—" : `${fmt(efAt * 100)}%`} → ${fmt(efPr * 100)}%`);
    const sp = sugerirMaximoPlanilha(u, r, p, u.maximoCompensavelPlanilha ?? 0.9);
    if (sp) par("Máximo Compensável ótimo na planilha modelo", `${fmt(sp.cobertura * 100)}%${u.maximoCompensavelPlanilha != null ? ` (planilha usava ${fmt(u.maximoCompensavelPlanilha * 100)}%)` : ""} · busca de 0 a 100% com projeção de ${p.mesesSimulacao} meses`);
    if (u.demanda) {
      const d = u.demanda;
      par("Demanda da usina", `contratada ${d.contratadaKw != null ? fmt(d.contratadaKw) : "—"} kW · registrada ${d.registradaKw != null ? fmt(d.registradaKw) : "—"} kW · ultrapassagem ${d.ultrapassagemKw != null ? fmt(d.ultrapassagemKw) : "—"} kW · despesa ${d.despesaUltrapassagem != null ? `R$ ${fmt(d.despesaUltrapassagem, 2)}` : "—"} (${d.fonte === "fatura" ? "fatura" : d.fonte === "planilha" ? "planilha" : "digitada"})`);
    }
    const cons = resumoConsumo(u);
    if (!cons.informados && u.ucs.length) par("Energia consumida no período", `não informada · estimativa pela soma do compensável das UCs: ${fmt(r.indicadores.consumoMensal)} kWh/mês`);
    if (cons.informados) par("Energia consumida no período (Relatório Gerencial GD)", `${fmt(cons.total)} kWh em ${cons.informados} competência(s) · média ${fmt(cons.media)} kWh/mês${cons.faltando ? ` · ${cons.faltando} sem valor` : ""}`);
    if (u.fatura) {
      const a = aplicacaoDaFatura(u.fatura);
      const s = scoreFatura(u.fatura, u.painel?.valores.injetada && u.painel.meses ? { kwh: u.painel.valores.injetada, meses: u.painel.meses } : null);
      par("Fatura da usina", `${u.fatura.arquivo} · referência ${u.fatura.mesReferencia || "—"} · confiança ${s.score}/100`);
      if (a.descricao.length) par("Leitura da fatura", a.descricao.join(". "));
    }
    if (u.painel) {
      const s = scorePainel(u.painel, u.fatura?.injetada);
      const v = u.painel.valores;
      par("Tela do Orange", `${u.painel.meses ?? "?"} meses · confiança ${s.score}/100 · injetada ${fmt(v.injetada ?? 0)} · compensada ${fmt(v.compensada ?? 0)} · saldo acumulado ${fmt(v.saldoAcumulado ?? 0)} kWh`);
    }
    row++;
    titulo(`Projeção mês a mês · ${r.usinaNome} (kWh)`);
    const h = ws.getRow(row);
    h.values = ["Mês", "Injeção", "Saldo · atual", "Saldo · proposto", "Saldo · estresse", "Compensado · proposto"];
    h.eachCell((c, n) => {
      c.font = { name: "Calibri", size: 8, bold: true, color: { argb: MUDO } };
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: FUNDO } };
      c.alignment = { horizontal: n === 1 ? "left" : "right", wrapText: true };
    });
    row++;
    const meses = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
    r.proposto.meses.forEach((m, k) => {
      const linha = ws.getRow(row++);
      linha.values = [`${m.indice}º (${meses[m.mes - 1]})`, m.injetado, r.atual.meses[k].saldoTotal, m.saldoTotal, r.propostoEstresse.meses[k].saldoTotal, m.compensado];
      linha.eachCell((c, n) => {
        c.font = { name: "Calibri", size: 9, color: { argb: TXT } };
        if (n > 1) c.numFmt = KWH;
        c.border = { bottom: { style: "hair", color: { argb: LINHA } } };
      });
    });
    row++;
  }

  titulo("Metodologia");
  for (const t of METODOLOGIA.slice(1)) {
    ws.mergeCells(row, 1, row, 6);
    const c = ws.getCell(row, 1);
    c.value = t;
    c.font = { name: "Calibri", size: 9, color: { argb: TXT } };
    c.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(row).height = Math.max(15, Math.ceil(t.length / 115) * 12.5);
    row++;
  }
}
