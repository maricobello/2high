import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { db } from "@/modules/db";
import { addIntentSignal } from "@/modules/crm/service";
import { notifyAdmins } from "@/modules/notifications/automation";

export const runtime = "nodejs";

const schema = z.object({ signal: z.enum(["requested_gd_proposal", "requested_ml_analysis", "requested_full_diagnostic"]) });

const LABELS = {
  requested_gd_proposal: "proposta de GD por assinatura",
  requested_ml_analysis: "análise comercial de Mercado Livre",
  requested_full_diagnostic: "diagnóstico completo",
} as const;

/** CTAs do relatório (diagnóstico completo, proposta de GD, análise de Mercado Livre). */
export async function POST(req: Request, ctx: RouteContext<"/api/leads/[token]/intent">) {
  try {
    const { token } = await ctx.params;
    const { signal } = schema.parse(await req.json());
    const lead = await db().getLeadByToken(token);
    if (!lead) return json({ error: "Protocolo não encontrado" }, 404);
    const already = lead.intentSignals.includes(signal);
    const updated = await addIntentSignal(lead.id, signal);
    if (!already && updated) {
      const label = LABELS[signal];
      await db().addActivity({ leadId: lead.id, type: "system", channel: "site", content: `Lead solicitou ${label} no Raio-X.`, meta: null, author: "lead" });
      await notifyAdmins(updated, `Lead solicitou ${label} pelo diagnóstico.`);
    }
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
