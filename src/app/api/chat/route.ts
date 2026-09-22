import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { brand } from "@/lib/brand";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { answer } from "@/modules/assistant/engine";
import { addIntentSignal } from "@/modules/crm/service";
import { db } from "@/modules/db";
import { classifyIntentByRules } from "@/modules/llm/tasks/messaging";
import { notifyAdmins } from "@/modules/notifications/automation";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(1200) }))
    .min(1)
    .max(30),
  token: z.string().min(16).max(64).optional().nullable(),
});

/**
 * Atendimento com IA no site. Sem token: conversa anônima (não armazenada).
 * Com token do lead: usa o diagnóstico como contexto e registra no CRM.
 */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`chat:${clientIp(req)}`, 40, 10 * 60 * 1000).ok) return json({ error: "Muitas mensagens em pouco tempo. Aguarde alguns minutos." }, 429);
    const body = schema.parse(await req.json());
    const lead = body.token ? await db().getLeadByToken(body.token) : null;
    const [diag, inv] = lead ? await Promise.all([db().getLatestDiagnostic(lead.id), db().getLatestInvoice(lead.id)]) : [null, null];

    const result = await answer(body.messages, {
      channel: "site",
      firstName: lead?.name.split(" ")[0] ?? null,
      company: lead?.company ?? null,
      hasInvoice: Boolean(inv),
      diagnostic: diag ? { summary: diag.summary, audit: diag.audit } : null,
    });

    const lastUser = [...body.messages].reverse().find((m) => m.role === "user")?.content ?? "";
    if (lead) {
      await db().addActivity({
        leadId: lead.id,
        type: "inbound_message",
        channel: "chat",
        content: `Cliente: ${lastUser}\nIA: ${result.reply}`,
        meta: { source: result.source, handoff: result.handoff },
        author: "lead",
      });
      await addIntentSignal(lead.id, "replied_message");
      const intent = classifyIntentByRules(lastUser);
      if (intent === "interessado" || intent === "agendar_reuniao" || result.handoff) {
        const updated = await addIntentSignal(lead.id, "positive_reply");
        if (result.handoff && updated) await notifyAdmins(updated, `Lead pediu atendimento humano no chat: "${lastUser.slice(0, 200)}"`);
      }
    }

    const whatsappUrl = lead
      ? `/api/leads/${lead.accessToken}/whatsapp`
      : brand.whatsapp
        ? `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent("Olá! Vim pelo site e gostaria de falar com um especialista sobre a conta de energia da minha empresa.")}`
        : null;

    return json({ ...result, whatsappUrl });
  } catch (err) {
    return errorResponse(err);
  }
}
