import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/modules/db";
import { changeStage } from "@/modules/crm/service";
import { stageIndex } from "@/modules/leads/types";

export const runtime = "nodejs";

const schema = z.object({
  type: z.enum(["note", "contact"]),
  channel: z.enum(["whatsapp", "telefone", "email", "reuniao", "outro"]).nullable().optional(),
  content: z.string().trim().min(1).max(5000),
});

/** Registra nota interna ou contato realizado (histórico de contatos). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/leads/[id]/activities">) {
  try {
    const session = await requireAdmin();
    const { id } = await ctx.params;
    const body = schema.parse(await req.json());
    const lead = await db().getLead(id);
    if (!lead) return json({ error: "Lead não encontrado" }, 404);
    const activity = await db().addActivity({
      leadId: id,
      type: body.type,
      channel: body.channel ?? null,
      content: body.content,
      meta: null,
      author: session.email,
    });
    // Contato registrado move o lead para "contato realizado" e encerra a automação
    if (body.type === "contact" && stageIndex(lead.stage) < stageIndex("contato_realizado")) {
      await changeStage(id, "contato_realizado", session.email, "contato registrado");
    }
    return json({ activity }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
