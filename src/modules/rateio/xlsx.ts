/**
 * Leitura e escrita de .xlsx no navegador (exceljs, carregado sob demanda).
 * Nada sai do computador do usuário: o arquivo é lido e gerado localmente.
 */
import type ExcelJS from "exceljs";
import { injecaoMensal } from "./engine";
import { textoParaGrid, type Cell, type Grid, type Sheet } from "./grid";
import { METODOLOGIA } from "./metodologia";
import type { Parametros, ResultadoProjeto, Usina } from "./types";

async function lib(): Promise<typeof ExcelJS> {
  const mod = await import("exceljs");
  return (mod as unknown as { default?: typeof ExcelJS }).default ?? (mod as unknown as typeof ExcelJS);
}

function cellToValue(v: ExcelJS.CellValue): Cell {
  if (v == null) return null;
  if (typeof v === "number" || typeof v === "string" || typeof v === "boolean" || v instanceof Date) return v;
  if (typeof v === "object") {
    if ("result" in v) return cellToValue((v as { result?: ExcelJS.CellValue }).result ?? null);
    if ("richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((t) => t.text).join("");
    if ("text" in v) return String((v as { text: unknown }).text);
    if ("error" in v) return null;
  }
  return null;
}

export async function lerArquivo(file: File): Promise<Sheet[]> {
  const nome = file.name.toLowerCase();
  if (nome.endsWith(".csv") || nome.endsWith(".txt") || nome.endsWith(".tsv")) {
    return [{ name: file.name, grid: textoParaGrid(await file.text()) }];
  }
  return lerXlsx(await file.arrayBuffer());
}

export async function lerXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const X = await lib();
  const wb = new X.Workbook();
  await wb.xlsx.load(buf);
  const sheets: Sheet[] = [];
  wb.eachSheet((ws) => {
    if (ws.state === "hidden" || ws.state === "veryHidden") return;
    const grid: Grid = [];
    const cols = ws.columnCount;
    for (let r = 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const out: Cell[] = [];
      for (let c = 1; c <= cols; c++) out.push(cellToValue(row.getCell(c).value));
      grid.push(out);
    }
    sheets.push({ name: ws.name, grid });
  });
  return sheets;
}

// ---------------------------------------------------------------------------
// Exportação

const COR = { ink: "FF04060C", primary: "FF3D5AFE", soft: "FFE8ECFF", verde: "FFE6F7EC", amarelo: "FFFFF4D6", vermelho: "FFFDE7E7", cinza: "FFF3F4F6" };
const ACAO_LABEL = { manter: "Manter", aumentar: "Aumentar", reduzir: "Reduzir", retirar: "Retirar", incluir: "Incluir" } as const;
const ACAO_COR = { manter: COR.cinza, aumentar: COR.verde, reduzir: COR.amarelo, retirar: COR.vermelho, incluir: COR.soft } as const;

function cabecalho(ws: ExcelJS.Worksheet, colunas: { header: string; key: string; width: number; fmt?: string }[]) {
  ws.columns = colunas.map((c) => ({ header: c.header, key: c.key, width: c.width, style: c.fmt ? { numFmt: c.fmt } : {} }));
  const h = ws.getRow(1);
  h.font = { bold: true, color: { argb: "FFFFFFFF" } };
  h.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.ink } };
  h.alignment = { vertical: "middle", wrapText: true };
  h.height = 30;
  ws.views = [{ state: "frozen", ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
}

const KWH = "#,##0";

export async function exportarXlsx(usinas: Usina[], resultado: ResultadoProjeto, p: Parametros, parecer?: Record<string, string>): Promise<Blob> {
  const X = await lib();
  const wb = new X.Workbook();
  wb.creator = "Aferi — Rateio GD";
  wb.created = new Date();
  const pctFmt = p.casasDecimais > 0 ? `0.${"0".repeat(p.casasDecimais)}` : "0";

  // Resumo
  const rs = wb.addWorksheet("Resumo");
  rs.columns = [{ width: 44 }, { width: 22 }, { width: 22 }, { width: 22 }];
  rs.addRow(["Estudo de rateio de créditos (GD)"]).font = { bold: true, size: 14 };
  rs.addRow([`Gerado em ${new Date().toLocaleString("pt-BR")}. Valores estimados: sujeitos à validação na fatura.`]).font = { italic: true, color: { argb: "FF6B7280" } };
  rs.addRow([]);
  rs.addRow(["Parâmetros"]).font = { bold: true };
  const params: [string, string | number][] = [
    ["Cobertura alvo do compensável", `${(p.cobertura * 100).toFixed(0)}%`],
    ["Horizonte para consumir saldo (meses)", p.horizonteSaldoMeses],
    ["Reserva de saldo (meses de consumo)", p.reservaSaldoMeses],
    ["Casas decimais / mínimo por UC", `${p.casasDecimais} / ${p.pctMinimo}%`],
    ["Projeção (meses) / mês de início", `${p.mesesSimulacao} / ${p.mesInicio}`],
    ["Cenário de estresse (consumo)", `${(p.fatorConsumoEstresse * 100).toFixed(0)}%`],
    ["Método", resultado.metodo === "otimizado" ? "Otimizado (programação linear, HiGHS)" : "Regra proporcional à necessidade"],
  ];
  for (const r of params) rs.addRow(r);

  for (const r of resultado.usinas) {
    const u = usinas.find((x) => x.id === r.usinaId)!;
    const i = r.indicadores;
    rs.addRow([]);
    const t = rs.addRow([r.usinaNome, "Atual", "Proposto", "Diferença"]);
    t.font = { bold: true, color: { argb: "FFFFFFFF" } };
    t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR.primary } };
    const linhas: [string, number, number, string][] = [
      ["Saldo de créditos ao fim da projeção (kWh)", r.atual.saldoFinal, r.proposto.saldoFinal, KWH],
      ["Crédito novo que vira saldo (kWh no período)", r.atual.creditoParaSaldoTotal, r.proposto.creditoParaSaldoTotal, KWH],
      ["Consumo sem crédito (kWh no período)", r.atual.consumoDescobertoTotal, r.proposto.consumoDescobertoTotal, KWH],
      ["Energia compensada (kWh no período)", r.atual.compensadoTotal, r.proposto.compensadoTotal, KWH],
    ];
    for (const [label, a, b, f] of linhas) {
      const row = rs.addRow([label, a, b, b - a]);
      [2, 3, 4].forEach((c) => (row.getCell(c).numFmt = f));
    }
    const info: [string, string | number][] = [
      ["Distribuidora / fornecedor", [u.distribuidora, u.fornecedor].filter(Boolean).join(" / ") || "—"],
      ["Injeção mensal projetada (kWh)", Math.round(injecaoMensal(u))],
      ["Saldo atual das UCs (kWh)", Math.round(i.saldoTotal)],
      ["Compensável atual (kWh/mês)", Math.round(i.compensavelTotal)],
      ["Compensável ideal a agregar (kWh/mês)", Math.round(i.compensavelIdealAgregar)],
      ["Compensável agregado com novas UCs (kWh/mês)", Math.round(i.compensavelAgregado)],
      ["UCs: atuais → propostas (incluídas / retiradas)", `${i.ucsAtuais} → ${i.ucsPropostas} (${i.incluidas} / ${i.retiradas})`],
      ["Injetada ÷ contratada", i.injetadaSobreContratada != null ? `${(i.injetadaSobreContratada * 100).toFixed(1)}%` : "—"],
      ["Gerada ÷ contratada", i.geradaSobreContratada != null ? `${(i.geradaSobreContratada * 100).toFixed(1)}%` : "—"],
    ];
    for (const row of info) rs.addRow(row).getCell(2).alignment = { horizontal: "right" };
    if (parecer?.[r.usinaId]) {
      rs.addRow([]);
      rs.addRow(["Parecer"]).font = { bold: true };
      const pr = rs.addRow([parecer[r.usinaId]]);
      rs.mergeCells(pr.number, 1, pr.number, 4);
      pr.alignment = { wrapText: true, vertical: "top" };
      pr.height = Math.min(400, 15 * Math.ceil(parecer[r.usinaId].length / 110));
    }
  }

  // Rateio proposto (todas as usinas)
  const ws = wb.addWorksheet("Rateio proposto");
  cabecalho(ws, [
    { header: "Usina", key: "usina", width: 22 },
    { header: "ID da Unidade", key: "id", width: 12 },
    { header: "N° de Instalação", key: "inst", width: 20 },
    { header: "Apelido", key: "apelido", width: 16 },
    { header: "Subgrupo", key: "sub", width: 9 },
    { header: "% atual", key: "pa", width: 10, fmt: pctFmt },
    { header: "% proposto", key: "pp", width: 11, fmt: pctFmt },
    { header: "Variação (p.p.)", key: "dp", width: 11, fmt: pctFmt },
    { header: "Ação", key: "acao", width: 11 },
    { header: "Situação hoje", key: "sit", width: 15 },
    { header: "Saldo kWh", key: "saldo", width: 12, fmt: KWH },
    { header: "Compensável kWh/mês", key: "comp", width: 13, fmt: KWH },
    { header: "Uso de saldo kWh/mês", key: "queima", width: 13, fmt: KWH },
    { header: "Crédito atual kWh/mês", key: "ca", width: 13, fmt: KWH },
    { header: "Crédito proposto kWh/mês", key: "cp", width: 13, fmt: KWH },
    { header: "Saldo hoje (meses)", key: "mh", width: 11, fmt: "0.0" },
    { header: "Saldo no fim — atual (meses)", key: "ma", width: 13, fmt: "0.0" },
    { header: "Saldo no fim — proposto (meses)", key: "mp", width: 13, fmt: "0.0" },
    { header: "Motivo", key: "motivo", width: 70 },
  ]);
  for (const r of resultado.usinas) {
    for (const l of r.linhas) {
      const row = ws.addRow({
        usina: r.usinaNome,
        id: l.idUnidade,
        inst: l.instalacao,
        apelido: l.apelido,
        sub: l.subgrupo,
        pa: l.pctAtual,
        pp: l.pctProposto,
        dp: l.pctProposto - l.pctAtual,
        acao: ACAO_LABEL[l.acao],
        sit: l.diagnostico.rotulo,
        saldo: l.saldoKwh,
        comp: l.compensavelKwh,
        queima: l.queimaSaldoMensal,
        ca: l.creditoAtualKwh,
        cp: l.creditoPropostoKwh,
        mh: l.mesesSaldoHoje,
        ma: l.mesesSaldoFimAtual,
        mp: l.mesesSaldoFimProposto,
        motivo: l.motivo,
      });
      row.getCell("acao").fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACAO_COR[l.acao] } };
    }
  }

  // Lista para envio: só instalação e percentual, uma aba por usina
  for (const r of resultado.usinas) {
    const nome = `Envio ${r.usinaNome}`.replace(/[\\/?*[\]:]/g, "").slice(0, 31);
    const es = wb.addWorksheet(nome);
    cabecalho(es, [
      { header: "Nº", key: "n", width: 6 },
      { header: "N° de Instalação (UC)", key: "inst", width: 22 },
      { header: "Apelido", key: "apelido", width: 16 },
      { header: "Percentual (%)", key: "pct", width: 14, fmt: pctFmt },
    ]);
    const ativas = r.linhas.filter((l) => l.pctProposto > 0).sort((a, b) => b.pctProposto - a.pctProposto);
    ativas.forEach((l, i) => es.addRow({ n: i + 1, inst: l.instalacao, apelido: l.apelido, pct: l.pctProposto }));
    const f = 10 ** p.casasDecimais;
    const tot = es.addRow({ inst: "TOTAL", pct: Math.round(ativas.reduce((a, l) => a + l.pctProposto, 0) * f) / f });
    tot.font = { bold: true };
  }

  // Novas UCs
  const ns = wb.addWorksheet("Novas UCs");
  cabecalho(ns, [
    { header: "UC", key: "inst", width: 20 },
    { header: "Endereço ID", key: "apelido", width: 18 },
    { header: "Concessionária", key: "dist", width: 14 },
    { header: "Ligação", key: "lig", width: 12 },
    { header: "Média kWh", key: "media", width: 11, fmt: KWH },
    { header: "Consumo mínimo", key: "min", width: 11, fmt: KWH },
    { header: "Compensável kWh/mês", key: "comp", width: 13, fmt: KWH },
    { header: "Resultado", key: "res", width: 12 },
    { header: "Usina destino", key: "dest", width: 18 },
    { header: "Motivo", key: "motivo", width: 60 },
  ]);
  for (const c of resultado.candidatas) {
    const row = ns.addRow({
      inst: c.candidata.instalacao,
      apelido: c.candidata.apelido,
      dist: c.candidata.concessionaria,
      lig: c.candidata.ligacaoOriginal,
      media: c.candidata.mediaKwh,
      min: c.candidata.consumoMinimoKwh,
      comp: c.candidata.compensavelKwh,
      res: c.selecionada ? "Incluída" : c.elegivel ? "Reserva" : "Não elegível",
      dest: c.usinaDestino ?? "",
      motivo: c.motivo,
    });
    row.getCell("res").fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.selecionada ? COR.verde : c.elegivel ? COR.cinza : COR.vermelho } };
  }

  // Alertas
  const as = wb.addWorksheet("Alertas");
  cabecalho(as, [
    { header: "Usina", key: "usina", width: 20 },
    { header: "Severidade", key: "sev", width: 11 },
    { header: "Alerta", key: "titulo", width: 50 },
    { header: "Detalhe", key: "det", width: 70 },
    { header: "UCs", key: "refs", width: 60 },
  ]);
  for (const r of resultado.usinas)
    for (const a of r.alertas) {
      const row = as.addRow({ usina: r.usinaNome, sev: a.severidade === "alta" ? "Alta" : a.severidade === "media" ? "Média" : "Baixa", titulo: a.titulo, det: a.detalhe, refs: a.refs?.join(", ") ?? "" });
      row.getCell("sev").fill = { type: "pattern", pattern: "solid", fgColor: { argb: a.severidade === "alta" ? COR.vermelho : a.severidade === "media" ? COR.amarelo : COR.cinza } };
      row.alignment = { wrapText: true, vertical: "top" };
    }

  // Validação
  const vs = wb.addWorksheet("Validação");
  cabecalho(vs, [
    { header: "Usina", key: "usina", width: 20 },
    { header: "Resultado", key: "res", width: 12 },
    { header: "Checagem", key: "titulo", width: 55 },
    { header: "Detalhe", key: "det", width: 70 },
  ]);
  for (const r of resultado.usinas)
    for (const v of r.validacoes) {
      const row = vs.addRow({ usina: r.usinaNome, res: v.ok ? "Aprovada" : v.nivel === "erro" ? "Reprovada" : "Aviso", titulo: v.titulo, det: v.detalhe });
      row.getCell("res").fill = { type: "pattern", pattern: "solid", fgColor: { argb: v.ok ? COR.verde : v.nivel === "erro" ? COR.vermelho : COR.amarelo } };
    }

  // Projeção mês a mês
  const ps = wb.addWorksheet("Projeção");
  cabecalho(ps, [
    { header: "Usina", key: "usina", width: 20 },
    { header: "Mês", key: "mes", width: 6 },
    { header: "Mês do ano", key: "mesAno", width: 8 },
    { header: "Injeção kWh", key: "inj", width: 13, fmt: KWH },
    { header: "Saldo — atual", key: "sa", width: 14, fmt: KWH },
    { header: "Saldo — proposto", key: "sp", width: 14, fmt: KWH },
    { header: "Saldo — estresse", key: "se", width: 14, fmt: KWH },
    { header: "Compensado — atual", key: "ca", width: 14, fmt: KWH },
    { header: "Compensado — proposto", key: "cp", width: 14, fmt: KWH },
  ]);
  for (const r of resultado.usinas)
    r.proposto.meses.forEach((m, i) =>
      ps.addRow({ usina: r.usinaNome, mes: m.indice, mesAno: m.mes, inj: m.injetado, sa: r.atual.meses[i].saldoTotal, sp: m.saldoTotal, se: r.propostoEstresse.meses[i].saldoTotal, ca: r.atual.meses[i].compensado, cp: m.compensado }),
    );

  // Metodologia
  const ms = wb.addWorksheet("Metodologia");
  ms.columns = [{ width: 120 }];
  for (const linha of METODOLOGIA) ms.addRow([linha]).alignment = { wrapText: true };

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
