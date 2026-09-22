import { errorResponse, json } from "@/lib/api";
import { getPublicDiagnostic } from "@/modules/pipeline/public-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/diagnostics/[token]">) {
  try {
    const { token } = await ctx.params;
    const view = await getPublicDiagnostic(token);
    if (!view) return json({ error: "Protocolo não encontrado" }, 404);
    return json(view, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
