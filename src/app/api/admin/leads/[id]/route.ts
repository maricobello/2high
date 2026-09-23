import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/modules/db";
import { changeStage, emitLeadEvent } from "@/modules/crm/service";
import { STAGE_VALUES } from "@/modules/leads/types";

export const runtime = "nodejs";

const patchSchema = z.object({
  stage: z.enum(STAGE_VALUES).optional(),
  owner: z.string().trim().max(120).nullable().optional(),
  partnerId: z.string().uuid().nullable().optional(),
  potentialValue: z.number().min(0).nullable().optional(),
  potentialCommission: z.number().min(0).nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  followUpOptOut: z.boolean().optional(),
});

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/leads/[id]">) {
  try {
    await requireAdmin();
    const { id } = await ctx.params;
    const lead = await db().getLead(id);
    if (!lead) return json({ error: "Lead não encontrado" }, 404);
    const [invoice, diagnostic, activities, followUps] = await Promise.all([
      db().getLatestInvoice(id),
      db().getLatestDiagnostic(id),
      db().listActivities(id),
      db().listFollowUps(id),
    ]);
    return json({ lead, invoice: invoice ? { ...invoice, ocrText: undefined } : null, diagnostic, activities, followUps });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, ctx: RouteContext<"/api/admin/leads/[id]">) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;
    const body = patchSchema.parse(await req.json());
    const { stage, ...rest } = body;
    let lead = await db().getLead(id);
    if (!lead) return json({ error: "Lead não encontrado" }, 404);
    if (Object.keys(rest).length) {
      lead = await db().updateLead(id, rest);
      if (rest.followUpOptOut) await db().cancelFollowUps(id);
      await db().addActivity({
        leadId: id,
        type: "system",
        channel: "crm",
        content: `Campos atualizados: ${Object.keys(rest).join(", ")}`,
        meta: rest,
        author: session.email,
      });
      void emitLeadEvent("lead.updated", lead);
    }
    if (stage) lead = await changeStage(id, stage, session.email);
    return json({ lead });
  } catch (err) {
    return errorResponse(err);
  }
}
