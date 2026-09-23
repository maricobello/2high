import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { hashIp, IntakeError, intakeQuickLead } from "@/modules/leads/intake";
import { quickLeadSchema } from "@/modules/leads/schema";
import { runLeadCapturedAutomation } from "@/modules/notifications/automation";

export const runtime = "nodejs";

/** Etapa 1 da isca: nome, e-mail e WhatsApp. Cria o lead e dispara boas-vindas + lembretes. */
export async function POST(req: Request) {
  try {
    const ip = clientIp(req);
    if (!rateLimit(`lead:${ip}`, 8, 60 * 60 * 1000).ok) throw new IntakeError("Muitas solicitações. Tente novamente mais tarde.", 429);
    const input = quickLeadSchema.parse(await req.json());
    const lead = await intakeQuickLead(input, { ipHash: hashIp(ip), userAgent: req.headers.get("user-agent") });
    after(() => runLeadCapturedAutomation(lead).catch((e) => console.error("[lead-start] automação", e)));
    return json({ protocol: lead.protocol, token: lead.accessToken }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
