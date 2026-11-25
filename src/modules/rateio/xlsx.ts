/**
 * Leitura e escrita de .xlsx no navegador (exceljs, carregado sob demanda).
 * Nada sai do computador do usuário: o arquivo é lido e gerado localmente.
 */
import type ExcelJS from "exceljs";
import { textoParaGrid, type Cell, type Grid, type Sheet } from "./grid";

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
