/**
 * PDF executivo do estudo, gerado no navegador (jsPDF, texto vetorial e selecionável):
 * por usina, página 1 com o resumo, página 2 com parecer e assinaturas e o Anexo I
 * com as UCs (maior consumo compensável primeiro). Mesmo conteúdo do Excel.
 */
import type { jsPDF as JsPDF } from "jspdf";
import {
  ACAO_LABEL,
  atencaoEstudo,
  AVISO_ESTIMATIVA,
  condutaEstudo,
  fmt,
  identificacao,
  kpisEstudo,
  LEGENDA_SITUACAO,
  linhasAnexo,
  protocoloEstudo,
  resumoAnexo,
  subtituloUsina,
  veredito,
} from "./estudo-dados";
import type { MarcaEstudo, OpcoesEstudo } from "./estudo-xlsx";
import { MARCA_PADRAO } from "./estudo-xlsx";
import type { Acao, Parametros, ResultadoProjeto, ResultadoUsina, Usina } from "./types";

type RGB = [number, number, number];
const hex = (h: string): RGB => {
  const s = h.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) || 0) as RGB;
};
const misturar = (c: RGB, alvo: number, f: number): RGB => c.map((v) => Math.round(v + (alvo - v) * f)) as RGB;

const TXT: RGB = [31, 41, 55];
const MUDO: RGB = [107, 114, 128];
const LINHA: RGB = [229, 231, 235];
const FUNDO: RGB = [249, 250, 251];
const GRAFITE: RGB = [63, 63, 70];
const OK: RGB = [21, 128, 61];
const ERRO: RGB = [185, 28, 28];
const ATENCAO: RGB = [180, 83, 9];
const ACAO_COR: Record<Acao, RGB> = { manter: MUDO, aumentar: OK, reduzir: ATENCAO, retirar: ERRO, incluir: [29, 78, 216] };

// A4 em mm
const W = 210;
const H = 297;
const M = 14;
const CW = W - 2 * M;

export interface FontesPdf {
  regular: string; // base64
  negrito: string; // base64
}

function paraBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

async function carregarFontes(): Promise<FontesPdf> {
  const [r, b] = await Promise.all([
    fetch(new URL("./pdf-fontes/Geist-Regular.ttf", import.meta.url)).then((x) => x.arrayBuffer()),
    fetch(new URL("./pdf-fontes/Geist-SemiBold.ttf", import.meta.url)).then((x) => x.arrayBuffer()),
  ]);
  return { regular: paraBase64(r), negrito: paraBase64(b) };
}

export async function exportarPdf(usinas: Usina[], resultado: ResultadoProjeto, p: Parametros, opcoes: OpcoesEstudo & { fontes?: FontesPdf }): Promise<Blob> {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const fontes = opcoes.fontes ?? (await carregarFontes());
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  doc.addFileToVFS("Geist-Regular.ttf", fontes.regular);
  doc.addFont("Geist-Regular.ttf", "Geist", "normal");
  doc.addFileToVFS("Geist-SemiBold.ttf", fontes.negrito);
  doc.addFont("Geist-SemiBold.ttf", "Geist", "bold");
  doc.setFont("Geist", "normal");

  const marca: MarcaEstudo = { ...MARCA_PADRAO, ...opcoes.marca };
  const corHex = /^#?[0-9a-f]{6}$/i.test(marca.cor) ? marca.cor : MARCA_PADRAO.cor;
  const C = { marca: hex(corHex), texto: misturar(hex(corHex), 0, 0.22), claro: misturar(hex(corHex), 255, 0.92), medio: misturar(hex(corHex), 255, 0.7), barra: misturar(hex(corHex), 255, 0.78) };
  const emissao = new Date().toLocaleDateString("pt-BR");
  const alvo = resultado.usinas.filter((r) => !opcoes.usinas?.length || opcoes.usinas.includes(r.usinaId));
  const rodapes: Record<number, string> = {};
  let logo: { data: string; w: number; h: number } | null = null;
  if (marca.logo && /^data:image\/(png|jpe?g);base64,/.test(marca.logo)) {
    const props = doc.getImageProperties(marca.logo);
    const h = 13;
    const w = Math.min(42, (props.width / props.height) * h);
    logo = { data: marca.logo, w, h: (w / ((props.width / props.height) * h)) * h };
  }

  alvo.forEach((r, idx) => {
    const u = usinas.find((x) => x.id === r.usinaId)!;
    if (idx > 0) doc.addPage();
    paginasEstudo(doc, autoTable, u, r, p, marca, C, logo, emissao, opcoes.pareceres?.[r.usinaId], opcoes.ciclo?.[r.usinaId], resultado.metodo, rodapes);
    paginasAnexo(doc, autoTable, u, r, p, marca, C, emissao, rodapes);
  });

  // rodapé em todas as páginas
  const total = doc.getNumberOfPages();
  let ultimo = "";
  for (let pg = 1; pg <= total; pg++) {
    doc.setPage(pg);
    ultimo = rodapes[pg] ?? ultimo;
    doc.setFont("Geist", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...MUDO);
    doc.text(`${marca.empresa ? `${marca.empresa} · ` : ""}${ultimo}`, M, H - 8);
    doc.text(`Página ${pg} de ${total}`, W - M, H - 8, { align: "right" });
  }
  return doc.output("blob");
}

type AutoTable = (d: JsPDF, o: Record<string, unknown>) => void;
type Cores = { marca: RGB; texto: RGB; claro: RGB; medio: RGB; barra: RGB };

function texto(doc: JsPDF, t: string, x: number, y: number, o: { size?: number; bold?: boolean; cor?: RGB; align?: "left" | "right" | "center"; maxW?: number } = {}): number {
  doc.setFont("Geist", o.bold ? "bold" : "normal");
  doc.setFontSize(o.size ?? 9);
  doc.setTextColor(...(o.cor ?? TXT));
  const linhas: string[] = o.maxW ? doc.splitTextToSize(t, o.maxW) : [t];
  doc.text(linhas, x, y, { align: o.align ?? "left", baseline: "top", lineHeightFactor: 1.25 });
  return linhas.length * (o.size ?? 9) * 0.3528 * 1.25;
}

function icone(doc: JsPDF, tipo: "ok" | "erro" | "aviso", x: number, y: number) {
  const cor = tipo === "ok" ? OK : tipo === "erro" ? ERRO : ATENCAO;
  doc.setDrawColor(...cor);
  doc.setLineWidth(0.45);
  if (tipo === "ok") {
    doc.line(x, y + 1.6, x + 1.1, y + 2.7);
    doc.line(x + 1.1, y + 2.7, x + 3.1, y + 0.4);
  } else if (tipo === "erro") {
    doc.line(x + 0.3, y + 0.4, x + 2.7, y + 2.8);
    doc.line(x + 2.7, y + 0.4, x + 0.3, y + 2.8);
  } else {
    doc.setFillColor(...cor);
    doc.rect(x + 1.2, y + 0.2, 0.6, 1.9, "F");
    doc.circle(x + 1.5, y + 2.75, 0.32, "F");
  }
}

// ---------------------------------------------------------------------------

function paginasEstudo(
  doc: JsPDF,
  autoTable: AutoTable,
  u: Usina,
  r: ResultadoUsina,
  p: Parametros,
  marca: MarcaEstudo,
  C: Cores,
  logo: { data: string; w: number; h: number } | null,
  emissao: string,
  parecer: string | undefined,
  ciclo: string | undefined,
  metodo: ResultadoProjeto["metodo"],
  rodapes: Record<number, string>,
) {
  rodapes[doc.getNumberOfPages()] = `Estudo de rateio · ${r.usinaNome}`;
  let y = 12;
  // --- cabeçalho
  let xt = M;
  if (logo) {
    const fmtImg = logo.data.startsWith("data:image/png") ? "PNG" : "JPEG";
    doc.addImage(logo.data, fmtImg, M, y, logo.w, logo.h);
    xt = M + logo.w + 6;
  }
  texto(doc, marca.empresa ? marca.empresa.toUpperCase() : "ESTUDO TÉCNICO", xt, y, { size: 7.5, bold: true, cor: C.texto });
  texto(doc, "Estudo de rateio de créditos", xt, y + 3.6, { size: 16, bold: true });
  texto(doc, subtituloUsina(u, r), xt, y + 10.6, { size: 9.5, cor: MUDO, maxW: W - M - 52 - xt });
  [
    ["Protocolo", protocoloEstudo(r.usinaNome, emissao)],
    ["Emissão", emissao],
    ["Ciclo", ciclo || "—"],
  ].forEach(([k, v], i) => {
    doc.setFont("Geist", "bold");
    doc.setFontSize(8);
    const wv = doc.getTextWidth(v);
    texto(doc, v, W - M, y + i * 4.6, { size: 8, bold: true, align: "right" });
    texto(doc, k, W - M - wv - 2.5, y + i * 4.6 + 0.3, { size: 7, cor: MUDO, align: "right" });
  });
  y = 30;
  doc.setDrawColor(...C.marca);
  doc.setLineWidth(0.7);
  doc.line(M, y, W - M, y);
  y += 6;

  const secao = (n: number, titulo: string) => {
    texto(doc, `${n}. ${titulo.toUpperCase()}`, M, y, { size: 8.5, bold: true, cor: C.texto });
    y += 4.6;
    doc.setDrawColor(...C.medio);
    doc.setLineWidth(0.25);
    doc.line(M, y, W - M, y);
    y += 2.6;
  };

  // --- 1. Identificação
  secao(1, "Identificação");
  const ident = identificacao(u, r, metodo);
  for (let k = 0; k < ident.length; k += 2) {
    let hMax = 0;
    ident.slice(k, k + 2).forEach(([lab, val], j) => {
      const x0 = M + j * (CW / 2);
      texto(doc, lab, x0, y + 0.4, { size: 7.5, cor: MUDO });
      hMax = Math.max(hMax, texto(doc, val, x0 + 30, y, { size: 8.8, bold: true, maxW: CW / 2 - 32 }));
    });
    y += Math.max(5.4, hMax + 1.6);
  }
  y += 3;

  // --- 2. Resultado
  secao(2, `Resultado esperado em ${p.mesesSimulacao} meses`);
  const kpis = kpisEstudo(r, p);
  const gap = 3;
  const bw = (CW - gap * 3) / 4;
  kpis.forEach((k, j) => {
    const x0 = M + j * (bw + gap);
    doc.setFillColor(...C.claro);
    doc.roundedRect(x0, y, bw, 19, 1.6, 1.6, "F");
    texto(doc, k.titulo, x0 + bw / 2, y + 2.4, { size: 6.8, bold: true, cor: MUDO, align: "center" });
    texto(doc, k.valor, x0 + bw / 2, y + 6.6, { size: 12, bold: true, cor: k.destaque ? C.texto : TXT, align: "center" });
    texto(doc, k.nota, x0 + bw / 2, y + 13.4, { size: 6.4, cor: MUDO, align: "center", maxW: bw - 3 });
  });
  y += 19 + 6;

  // --- 3. Conduta
  secao(3, "Conduta (o que muda no rateio)");
  const cond = condutaEstudo(r);
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [["Ação", "UCs", "O que significa"]],
    body: cond.map((c) => [ACAO_LABEL[c.acao], String(c.n), c.efeito]),
    theme: "plain",
    styles: { font: "Geist", fontSize: 8.3, textColor: MUDO, cellPadding: { top: 1.6, bottom: 1.6, left: 2, right: 2 }, lineColor: LINHA, lineWidth: 0.2 },
    headStyles: { fontStyle: "bold", fontSize: 7, textColor: MUDO, fillColor: FUNDO },
    columnStyles: { 0: { cellWidth: 30, fontStyle: "bold" }, 1: { cellWidth: 16, halign: "center", textColor: TXT, fontStyle: "bold" } },
    didParseCell: (d: { section: string; column: { index: number }; row: { index: number }; cell: { styles: { textColor: RGB } } }) => {
      if (d.section === "body" && d.column.index === 0) d.cell.styles.textColor = ACAO_COR[cond[d.row.index].acao];
    },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 1.6;
  texto(doc, "UC por UC no Anexo I (logo após o parecer).", M, y, { size: 6.8, cor: MUDO });
  y += 7;

  // --- 4. Validação
  secao(4, "Validação antes do envio");
  const ver = veredito(r);
  const fundoVer: RGB = ver.nivel === "erro" ? [254, 242, 242] : ver.nivel === "aviso" ? [255, 251, 235] : [240, 253, 244];
  doc.setFillColor(...fundoVer);
  doc.rect(M, y, CW, 6.6, "F");
  texto(doc, ver.texto, M + 2.5, y + 1.6, { size: 8.8, bold: true, cor: ver.nivel === "erro" ? ERRO : ver.nivel === "aviso" ? ATENCAO : OK });
  y += 8.4;
  for (const v of r.validacoes) {
    icone(doc, v.ok ? "ok" : v.nivel === "erro" ? "erro" : "aviso", M + 1.5, y + 0.3);
    const h1 = texto(doc, v.titulo, M + 8, y, { size: 8, maxW: 92 });
    const h2 = texto(doc, v.detalhe, M + 104, y + 0.3, { size: 7, cor: MUDO, maxW: CW - 104 });
    y += Math.max(h1, h2) + 1.5;
  }
  y += 3;

  // --- 5. Pontos de atenção
  const at = atencaoEstudo(r);
  if (at.length) {
    if (y > H - 50) {
      doc.addPage();
      rodapes[doc.getNumberOfPages()] = `Estudo de rateio · ${r.usinaNome}`;
      y = 16;
    }
    secao(5, "Pontos de atenção");
    for (const a of at) {
      const cor = a.severidade === "alta" ? ERRO : ATENCAO;
      doc.setFillColor(...cor);
      doc.setDrawColor(...cor);
      doc.setLineWidth(0.35);
      doc.circle(M + 2.2, y + 1.7, 0.9, a.severidade === "alta" ? "F" : "S");
      const h1 = texto(doc, a.titulo, M + 6, y, { size: 8, bold: true, maxW: CW - 8 });
      const h2 = texto(doc, a.detalhe, M + 6, y + h1 + 0.4, { size: 7.4, cor: MUDO, maxW: CW - 8 });
      const yy = y + h1 + 0.4 + h2;
      y = yy + 1.4;
    }
  }

  // --- página 2: parecer e assinaturas
  doc.addPage();
  rodapes[doc.getNumberOfPages()] = `Estudo de rateio · ${r.usinaNome}`;
  y = 16;
  if (parecer?.trim()) {
    secao(at.length ? 6 : 5, "Parecer técnico");
    for (const par of parecer.trim().split(/\n+/)) {
      y += texto(doc, par.trim(), M, y, { size: 9, maxW: CW }) + 2.4;
    }
    y += 6;
  }
  y = Math.max(y + 14, 80);
  doc.setDrawColor(...TXT);
  doc.setLineWidth(0.25);
  doc.line(M, y, M + 80, y);
  doc.line(W - M - 75, y, W - M, y);
  texto(doc, `Responsável técnico${marca.responsavel ? `: ${marca.responsavel}` : ""}`, M, y + 1.6, { size: 7.5, cor: MUDO });
  texto(doc, "De acordo (cliente / fornecedor)", W - M - 75, y + 1.6, { size: 7.5, cor: MUDO });
  texto(doc, AVISO_ESTIMATIVA, M, y + 12, { size: 7, cor: MUDO, maxW: CW });
}

// ---------------------------------------------------------------------------

function paginasAnexo(doc: JsPDF, autoTable: AutoTable, u: Usina, r: ResultadoUsina, p: Parametros, marca: MarcaEstudo, C: Cores, emissao: string, rodapes: Record<number, string>) {
  doc.addPage();
  const inicio = doc.getNumberOfPages();
  rodapes[inicio] = `Anexo I · UCs no rateio · ${r.usinaNome}`;
  let y = 14;
  texto(doc, `${marca.empresa ? `${marca.empresa.toUpperCase()} · ` : ""}ANEXO I`, M, y, { size: 7.5, bold: true, cor: C.texto });
  texto(doc, `UCs no rateio · ${r.usinaNome}`, M, y + 3.6, { size: 14, bold: true });
  const hRes = texto(doc, resumoAnexo(u, r, p, emissao), M, y + 10, { size: 8, cor: MUDO, maxW: CW });
  y += 10 + hRes + 2.2;
  doc.setDrawColor(...C.marca);
  doc.setLineWidth(0.6);
  doc.line(M, y, W - M, y);
  y += 3;

  const casas = p.casasDecimais;
  const pct = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const linhas = linhasAnexo(r);
  const maxComp = Math.max(1, ...linhas.map((l) => l.compensavelKwh));
  const f = 10 ** casas;
  const soma = (k: "pctAtual" | "pctProposto") => Math.round(r.linhas.reduce((a, l) => a + l[k], 0) * f) / f;
  const body = linhas.map((l, k) => {
    const d = l.pctProposto - l.pctAtual;
    return [
      String(k + 1),
      l.instalacao,
      l.apelido || "—",
      l.diagnostico.rotulo,
      pct(l.pctAtual),
      pct(l.pctProposto),
      `${d > 0 ? "+" : ""}${pct(d)}`,
      ACAO_LABEL[l.acao],
      fmt(l.compensavelKwh),
      l.origem === "nova" || l.mesesSaldoHoje == null ? "" : fmt(l.mesesSaldoHoje, 1),
    ];
  });
  const foot = [["", "TOTAL", "", "", pct(soma("pctAtual")), pct(soma("pctProposto")), "", "", fmt(r.linhas.reduce((a, l) => a + Math.max(0, l.compensavelKwh), 0)), ""]];

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, top: 14, bottom: 14 },
    head: [["Nº", "UC (instalação)", "Apelido", "Situação hoje", "% atual", "% proposto", "Variação (p.p.)", "Ação", "Consumo compensável (kWh/mês)", "Saldo hoje (meses)"]],
    body,
    foot,
    showHead: "everyPage",
    showFoot: "lastPage",
    theme: "plain",
    styles: { font: "Geist", fontSize: 7, textColor: TXT, cellPadding: { top: 1.05, bottom: 1.05, left: 1.4, right: 1.4 }, valign: "middle", overflow: "ellipsize" },
    headStyles: { fillColor: GRAFITE, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 6.6, valign: "middle", overflow: "linebreak" },
    footStyles: { fontStyle: "bold", fontSize: 7.4, textColor: TXT },
    alternateRowStyles: { fillColor: FUNDO },
    columnStyles: {
      0: { cellWidth: 7, halign: "center", textColor: MUDO },
      1: { cellWidth: 25 },
      2: { cellWidth: 21 },
      3: { cellWidth: 21 },
      4: { cellWidth: 13, halign: "right" },
      5: { cellWidth: 15, halign: "right", fontStyle: "bold" },
      6: { cellWidth: 15, halign: "right" },
      7: { cellWidth: 17 },
      8: { cellWidth: 32, halign: "right" },
      9: { cellWidth: 16, halign: "right" },
    },
    didParseCell: (d: { section: string; column: { index: number }; row: { index: number }; cell: { styles: Record<string, unknown> } }) => {
      if (d.section === "head") d.cell.styles.halign = [0].includes(d.column.index) ? "center" : [4, 5, 6, 8, 9].includes(d.column.index) ? "right" : "left";
      if (d.section !== "body") return;
      const l = linhas[d.row.index];
      if (d.column.index === 7) {
        d.cell.styles.textColor = ACAO_COR[l.acao];
        d.cell.styles.fontStyle = "bold";
      }
      if (d.column.index === 6) {
        const dv = l.pctProposto - l.pctAtual;
        d.cell.styles.textColor = Math.abs(dv) < 10 ** -casas / 2 ? MUDO : dv > 0 ? OK : ATENCAO;
      }
    },
    willDrawCell: (d: { section: string; column: { index: number }; row: { index: number }; cell: { x: number; y: number; width: number; height: number } }) => {
      // barra proporcional ao consumo compensável, atrás do número
      if (d.section === "body" && d.column.index === 8) {
        const l = linhas[d.row.index];
        const w = Math.max(0, (l.compensavelKwh / maxComp) * (d.cell.width - 2));
        doc.setFillColor(...C.barra);
        doc.rect(d.cell.x + 1, d.cell.y + 0.8, w, d.cell.height - 1.6, "F");
      }
    },
    didDrawCell: (d: { section: string; row: { index: number }; cell: { x: number; y: number; width: number; height: number } }) => {
      if (d.section === "head") {
        doc.setDrawColor(...C.marca);
        doc.setLineWidth(0.5);
        doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height);
      }
      if (d.section === "foot") {
        doc.setDrawColor(...C.marca);
        doc.setLineWidth(0.5);
        doc.line(d.cell.x, d.cell.y, d.cell.x + d.cell.width, d.cell.y);
      }
    },
    didDrawPage: () => {
      const pg = doc.getNumberOfPages();
      rodapes[pg] = `Anexo I · UCs no rateio · ${r.usinaNome}`;
    },
  });
  const fim = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;
  if (fim < H - 26) texto(doc, LEGENDA_SITUACAO, M, fim, { size: 6.6, cor: MUDO, maxW: CW });
}
