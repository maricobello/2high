/**
 * Reduz fotos de fatura no navegador antes do envio (limite de ~4 MB por requisição
 * nas funções serverless). Mantém legibilidade para OCR (lado maior até 2200 px).
 */
export async function compressImageIfNeeded(file: File, maxBytes = 1_800_000, maxSide = 2200): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= maxBytes) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.85, 0.75, 0.65]) {
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", quality));
      if (blob && (blob.size <= maxBytes || quality === 0.65)) {
        return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
      }
    }
    return file;
  } catch {
    return file;
  }
}

export function readUtm(): Record<string, string> | undefined {
  if (typeof window === "undefined") return undefined;
  const p = new URLSearchParams(window.location.search);
  const out: Record<string, string> = {};
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"]) {
    const v = p.get(k);
    if (v) out[k] = v.slice(0, 200);
  }
  if (document.referrer) out.referrer = document.referrer.slice(0, 200);
  return Object.keys(out).length ? out : undefined;
}
