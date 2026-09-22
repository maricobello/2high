import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/modules/db";
import { processLead } from "@/modules/pipeline/process-lead";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Reexecuta o pipeline (ex.: após configurar a IA ou ajustar parâmetros do motor). */
export async function POST(_req: Request, ctx: RouteContext<"/api/admin/leads/[id]/reprocess">) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;
    const lead = await db().getLead(id);
    if (!lead) return json({ error: "Lead não encontrado" }, 404);
    await db().updateLead(id, { processingStatus: "pending" });
    await db().addActivity({ leadId: id, type: "system", channel: "crm", content: "Reprocessamento solicitado.", meta: null, author: session.email });
    after(() => processLead(id).catch((e) => console.error("[reprocess]", e)));
    return json({ ok: true }, 202);
  } catch (err) {
    return errorResponse(err);
  }
}
