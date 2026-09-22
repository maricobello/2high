import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { eraseLead } from "@/modules/crm/erase";
import { db } from "@/modules/db";

export const runtime = "nodejs";

/** Exclusão definitiva (direito do titular). Irreversível. */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/leads/[id]/erase">) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;
    const lead = await db().getLead(id);
    if (!lead) return json({ error: "Lead não encontrado" }, 404);
    const requests = (await db().listPrivacyRequests()).filter((r) => r.leadId === id && r.status !== "concluida");
    const r = await eraseLead(id);
    for (const req of requests) {
      await db().updatePrivacyRequest(req.id, { status: "concluida", resolvedAt: new Date().toISOString(), resolutionNote: `Dados excluídos por ${session.email}.` });
    }
    console.info(`[lgpd] lead ${lead.protocol} excluído por ${session.email} (${r.files} arquivos)`);
    return json({ ok: true, ...r });
  } catch (err) {
    return errorResponse(err);
  }
}
