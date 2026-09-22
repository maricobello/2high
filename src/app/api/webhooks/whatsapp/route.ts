import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqual } from "@/modules/auth/session";
import { db } from "@/modules/db";
import { addIntentSignal, changeStage } from "@/modules/crm/service";
import { classifyIntent } from "@/modules/llm/tasks/messaging";
import { notifyAdmins } from "@/modules/notifications/automation";
import { isHumanHandled } from "@/modules/leads/types";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Verificação do webhook da Meta (WhatsApp Cloud API). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    env.metaWhatsappVerifyToken &&
    url.searchParams.get("hub.verify_token") === env.metaWhatsappVerifyToken
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * Mensagens recebidas. Aceita:
 *  - payload da Meta (assinado com X-Hub-Signature-256 / META_APP_SECRET)
 *  - payload genérico {phone, message} com header Authorization: Bearer WHATSAPP_WEBHOOK_TOKEN
 * Classifica a intenção (regras + IA), registra no CRM e age automaticamente.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const metaSig = req.headers.get("x-hub-signature-256");
  const appSecret = process.env.META_APP_SECRET || "";
  let authorized = false;
  if (metaSig && appSecret) {
    const expected = `sha256=${createHmac("sha256", appSecret).update(raw).digest("hex")}`;
    authorized = safeEqual(metaSig, expected);
  } else if (env.whatsappWebhookToken) {
    authorized = safeEqual(req.headers.get("authorization") ?? "", `Bearer ${env.whatsappWebhookToken}`);
  }
  if (!authorized) return new Response("Unauthorized", { status: 401 });

  let messages: { phone: string; text: string }[] = [];
  try {
    const body = JSON.parse(raw);
    if (body?.object === "whatsapp_business_account") {
      for (const entry of body.entry ?? [])
        for (const change of entry.changes ?? [])
          for (const m of change.value?.messages ?? []) if (m.type === "text") messages.push({ phone: m.from, text: m.text?.body ?? "" });
    } else if (body?.phone && body?.message) {
      messages = [{ phone: String(body.phone), text: String(body.message) }];
    }
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  for (const msg of messages) {
    const lead = await db().findLeadByPhone(msg.phone.replace(/\D/g, ""));
    if (!lead) continue;
    const { intent, source } = await classifyIntent(msg.text);
    await db().addActivity({
      leadId: lead.id,
      type: "inbound_message",
      channel: "whatsapp",
      content: msg.text.slice(0, 2000),
      meta: { intent, classifier: source },
      author: "lead",
    });
    await addIntentSignal(lead.id, "replied_message");
    if (intent === "opt_out") {
      await db().updateLead(lead.id, { followUpOptOut: true });
      await db().cancelFollowUps(lead.id);
    } else if (intent === "interessado" || intent === "agendar_reuniao") {
      const updated = await addIntentSignal(lead.id, "positive_reply");
      await db().cancelFollowUps(lead.id);
      if (updated && !isHumanHandled(updated.stage)) await changeStage(lead.id, "qualificado", "automação", `resposta: ${intent}`);
      const fresh = await db().getLead(lead.id);
      if (fresh) await notifyAdmins(fresh, `Lead respondeu no WhatsApp (${intent}): "${msg.text.slice(0, 280)}"`);
    }
  }
  return Response.json({ ok: true, received: messages.length });
}
