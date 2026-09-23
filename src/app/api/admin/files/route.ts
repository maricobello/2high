import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { storage } from "@/modules/storage";
import { env } from "@/lib/env";

export const runtime = "nodejs";

/** Download autenticado de fatura (driver local) ou redirect para URL assinada (Supabase). */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const key = new URL(req.url).searchParams.get("key");
    if (!key || key.includes("..")) return json({ error: "Arquivo inválido" }, 400);
    if (env.dataDriver === "supabase") {
      const url = await storage().signedUrl(key, 120);
      return url ? Response.redirect(url, 302) : json({ error: "Arquivo não encontrado" }, 404);
    }
    const buf = await storage().read(key);
    const type = key.endsWith(".pdf") ? "application/pdf" : key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": type, "Cache-Control": "private, no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
