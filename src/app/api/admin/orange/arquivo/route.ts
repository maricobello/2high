import { errorResponse } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { storage } from "@/modules/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Arquivo coletado pelo robô (só dentro de orange/coletas/), para o rateio importar. */
export async function GET(req: Request) {
  try {
    await requireAdmin();
    const chave = new URL(req.url).searchParams.get("chave") ?? "";
    if (!/^orange\/coletas\/\d{4}-\d{2}\/[\w.-]+$/.test(chave)) return Response.json({ error: "Arquivo inválido" }, { status: 400 });
    const buf = await storage().read(chave);
    const nome = chave.split("/").pop()!;
    return new Response(new Uint8Array(buf), { headers: { "Content-Type": "application/octet-stream", "Content-Disposition": `attachment; filename="${nome}"`, "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
