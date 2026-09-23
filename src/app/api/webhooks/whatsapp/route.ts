import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { safeEqual } from "@/modules/auth/session";
import { db } from "@/modules/db";
import { addIntentSignal, changeStage } from "@/modules/crm/service";
import { classifyIntent } from "@/modules/llm/tasks/messaging";
import { notifyAdmins } from "@/modules/notifications/automation";
import { isHumanHandled } from "@/modules/leads/types";
import { answer, type AssistantTurn } from "@/modules/assistant/engine";
import { sendWhatsApp } from "@/modules/notifications/channels";

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

    // Atendimento com IA no WhatsApp (dentro da janela de 24h aberta pela mensagem do cliente)
    const current = await db().getLead(lead.id);
    if (process.env.AI_WHATSAPP_AUTOREPLY === "true" && intent !== "opt_out" && current && !isHumanHandled(current.stage)) {
      const acts = (await db().listActivities(lead.id))
        .filter((a) => a.channel === "whatsapp" && (a.type === "inbound_message" || (a.type === "notification" && a.author === "IA")))
        .slice(0, 8)
        .reverse();
      const history: AssistantTurn[] = acts.map((a) => ({ role: a.type === "inbound_message" ? "user" : "assistant", content: a.content.replace(/^IA: /, "") }));
      const [diag, inv] = await Promise.all([db().getLatestDiagnostic(lead.id), db().getLatestInvoice(lead.id)]);
      const r = await answer(history.length ? history : [{ role: "user", content: msg.text }], {
        channel: "whatsapp",
        firstName: lead.name.split(" ")[0],
        company: lead.company,
        hasInvoice: Boolean(inv),
        diagnostic: diag ? { summary: diag.summary, audit: diag.audit } : null,
      });
      const text = r.handoff ? `${r.reply}\n\nJá avisei nosso especialista, que vai continuar por aqui.` : r.reply;
      await sendWhatsApp({ leadId: lead.id, phone: lead.phone, message: text, template: "ai_reply" });
      await db().addActivity({ leadId: lead.id, type: "notification", channel: "whatsapp", content: `IA: ${text}`, meta: { source: r.source }, author: "IA" });
      if (r.handoff) await notifyAdmins(current, `Lead pediu atendimento humano no WhatsApp: "${msg.text.slice(0, 200)}"`);
    }
  }
  return Response.json({ ok: true, received: messages.length });
}
