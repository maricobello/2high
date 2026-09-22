import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/modules/db";
import { addIntentSignal } from "@/modules/crm/service";
import { attachInvoice, IntakeError, validateUpload } from "@/modules/leads/intake";
import { processLead } from "@/modules/pipeline/process-lead";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Permite enviar a fatura depois (ex.: leads vindos dos simuladores). */
export async function POST(req: Request, ctx: RouteContext<"/api/leads/[token]/invoice">) {
  try {
    const rl = rateLimit(`invoice:${clientIp(req)}`, 10, 60 * 60 * 1000);
    if (!rl.ok) throw new IntakeError("Muitas solicitações. Tente novamente mais tarde.", 429);
    const { token } = await ctx.params;
    const lead = await db().getLeadByToken(token);
    if (!lead) return json({ error: "Protocolo não encontrado" }, 404);
    if (lead.processingStatus === "processing" || lead.processingStatus === "pending") {
      throw new IntakeError("Já existe uma análise em andamento para este protocolo.", 409);
    }
    const form = await req.formData();
    const f = form.get("file");
    if (!f || typeof f === "string" || f.size === 0) throw new IntakeError("Envie a fatura em PDF ou imagem.");
    const file = { name: f.name, type: f.type, bytes: Buffer.from(await f.arrayBuffer()) };
    const mime = validateUpload(file);
    await attachInvoice(lead, file, mime);
    await db().updateLead(lead.id, { processingStatus: "pending" });
    await addIntentSignal(lead.id, "uploaded_invoice");
    after(async () => {
      try {
        await processLead(lead.id);
      } catch (err) {
        console.error("[invoice] processamento falhou", err);
      }
    });
    return json({ ok: true }, 202);
  } catch (err) {
    return errorResponse(err);
  }
}
