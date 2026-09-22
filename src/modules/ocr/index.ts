import "server-only";
import { env } from "@/lib/env";

/**
 * Camada de OCR/extração de texto.
 * - PDF com texto: leitura direta (unpdf) — sem custo.
 * - PDF digitalizado / imagem: OCR.space (se configurado). Imagens também seguem
 *   para leitura por visão computacional na etapa de extração (Groq Vision).
 */
export interface OcrResult {
  text: string;
  provider: "pdf-text" | "ocr.space" | "none";
  pages: number | null;
  /** true quando o documento não tem camada de texto utilizável */
  scanned: boolean;
  warnings: string[];
}

export const ACCEPTED_MIME = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
export type AcceptedMime = (typeof ACCEPTED_MIME)[number];

/** Confere a assinatura binária do arquivo (não confia só no mime enviado). */
export function sniffMime(buf: Buffer): AcceptedMime | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

export async function extractText(buf: Buffer, mime: AcceptedMime): Promise<OcrResult> {
  const warnings: string[] = [];
  if (mime === "application/pdf") {
    try {
      const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { totalPages, text } = await pdfText(pdf, { mergePages: true });
      const clean = (Array.isArray(text) ? text.join("\n") : text).trim();
      if (clean.replace(/\s/g, "").length >= 150) {
        return { text: clean, provider: "pdf-text", pages: totalPages, scanned: false, warnings };
      }
      warnings.push("PDF sem camada de texto (provavelmente digitalizado).");
      const ocr = await ocrSpace(buf, mime);
      if (ocr) return { text: ocr, provider: "ocr.space", pages: totalPages, scanned: true, warnings };
      return { text: clean, provider: "none", pages: totalPages, scanned: true, warnings };
    } catch (err) {
      warnings.push(`Falha ao ler PDF: ${err instanceof Error ? err.message : String(err)}`);
      const ocr = await ocrSpace(buf, mime);
      return { text: ocr ?? "", provider: ocr ? "ocr.space" : "none", pages: null, scanned: true, warnings };
    }
  }
  const ocr = await ocrSpace(buf, mime);
  if (!ocr) warnings.push("OCR de imagem não configurado; será usada leitura por visão computacional.");
  return { text: ocr ?? "", provider: ocr ? "ocr.space" : "none", pages: 1, scanned: true, warnings };
}

async function ocrSpace(buf: Buffer, mime: AcceptedMime): Promise<string | null> {
  if (!env.ocrSpaceApiKey) return null;
  try {
    const form = new FormData();
    form.append("base64Image", `data:${mime};base64,${buf.toString("base64")}`);
    form.append("language", "por");
    form.append("isTable", "true");
    form.append("OCREngine", "2");
    form.append("scale", "true");
    if (mime === "application/pdf") form.append("filetype", "PDF");
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: env.ocrSpaceApiKey },
      body: form,
      signal: AbortSignal.timeout(40000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ParsedResults?: { ParsedText?: string }[]; IsErroredOnProcessing?: boolean };
    if (json.IsErroredOnProcessing) return null;
    const text = (json.ParsedResults ?? []).map((r) => r.ParsedText ?? "").join("\n").trim();
    return text.length > 50 ? text : null;
  } catch (err) {
    console.warn("[ocr] OCR.space falhou:", err instanceof Error ? err.message : err);
    return null;
  }
}
