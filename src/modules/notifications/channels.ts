import "server-only";
import { createHmac } from "node:crypto";
import { env } from "@/lib/env";
import { db } from "@/modules/db";

/**
 * Canais de saída. Cada envio é registrado na tabela notifications.
 * Sem credenciais configuradas, o envio é "skipped" (e logado) — o fluxo nunca quebra.
 */
type SendResult = { status: "sent" | "failed" | "skipped"; response: string };

async function log(leadId: string | null, channel: "email" | "whatsapp" | "webhook", recipient: string, template: string, r: SendResult) {
  try {
    await db().addNotification({ leadId, channel, recipient, template, status: r.status, providerResponse: r.response.slice(0, 1000) });
  } catch (err) {
    console.error("[notifications] falha ao registrar", err);
  }
  if (r.status !== "sent") console.info(`[notifications] ${channel}/${template} -> ${recipient}: ${r.status} (${r.response.slice(0, 200)})`);
  return r;
}

/* ------------------------------ E-mail (Resend) ------------------------------ */

export async function sendEmail(opts: { leadId: string | null; to: string | string[]; subject: string; html: string; text?: string; template: string }) {
  const to = Array.isArray(opts.to) ? opts.to : [opts.to];
  let r: SendResult;
  if (!env.resendApiKey) {
    r = { status: "skipped", response: "RESEND_API_KEY não configurada" };
  } else {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: env.emailFrom, to, subject: opts.subject, html: opts.html, text: opts.text }),
        signal: AbortSignal.timeout(15000),
      });
      r = { status: res.ok ? "sent" : "failed", response: await res.text() };
    } catch (err) {
      r = { status: "failed", response: String(err) };
    }
  }
  return log(opts.leadId, "email", to.join(","), opts.template, r);
}

/* ------------------------------ WhatsApp ------------------------------ */

/** Normaliza para E.164 brasileiro (somente dígitos, com 55). */
export function toE164BR(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.startsWith("55") && d.length >= 12) return d;
  return `55${d}`;
}

/**
 * Provedores:
 * - "meta": WhatsApp Cloud API. Fora da janela de 24h, a Meta exige template aprovado
 *   (META_WHATSAPP_TEMPLATE com 1 variável de corpo). Dentro da janela, texto livre.
 * - "webhook": POST genérico (Z-API, Evolution API, n8n, Make…) com {phone, message}.
 */
export async function sendWhatsApp(opts: { leadId: string | null; phone: string; message: string; template: string; preferTemplate?: boolean }) {
  const to = toE164BR(opts.phone);
  let r: SendResult;
  try {
    if (env.whatsappProvider === "meta" && env.metaWhatsappToken && env.metaWhatsappPhoneNumberId) {
      const useTemplate = opts.preferTemplate && env.metaWhatsappTemplate;
      const payload = useTemplate
        ? {
            messaging_product: "whatsapp",
            to,
            type: "template",
            template: {
              name: env.metaWhatsappTemplate,
              language: { code: env.metaWhatsappTemplateLang },
              components: [{ type: "body", parameters: [{ type: "text", text: opts.message.slice(0, 1000) }] }],
            },
          }
        : { messaging_product: "whatsapp", to, type: "text", text: { body: opts.message, preview_url: true } };
      const res = await fetch(`https://graph.facebook.com/v21.0/${env.metaWhatsappPhoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${env.metaWhatsappToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      r = { status: res.ok ? "sent" : "failed", response: await res.text() };
    } else if (env.whatsappProvider === "webhook" && env.whatsappWebhookUrl) {
      const res = await fetch(env.whatsappWebhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.whatsappWebhookToken ? { Authorization: `Bearer ${env.whatsappWebhookToken}`, "Client-Token": env.whatsappWebhookToken } : {}),
        },
        body: JSON.stringify({ phone: to, message: opts.message }),
        signal: AbortSignal.timeout(15000),
      });
      r = { status: res.ok ? "sent" : "failed", response: await res.text() };
    } else {
      r = { status: "skipped", response: "WhatsApp não configurado (WHATSAPP_PROVIDER)" };
    }
  } catch (err) {
    r = { status: "failed", response: String(err) };
  }
  return log(opts.leadId, "whatsapp", to, opts.template, r);
}

export function whatsappConfigured(): boolean {
  return (
    (env.whatsappProvider === "meta" && Boolean(env.metaWhatsappToken && env.metaWhatsappPhoneNumberId)) ||
    (env.whatsappProvider === "webhook" && Boolean(env.whatsappWebhookUrl))
  );
}

/* ------------------------------ Webhooks de saída ------------------------------ */

export function signPayload(body: string): string {
  return env.webhookSigningSecret ? createHmac("sha256", env.webhookSigningSecret).update(body).digest("hex") : "";
}

/**
 * Envia evento assinado (HMAC-SHA256 no header X-Signature) para CRM externo,
 * n8n, Make, Zapier, Slack etc.
 */
export async function sendWebhook(opts: { leadId: string | null; url: string; event: string; data: unknown }) {
  if (!opts.url) return { status: "skipped" as const, response: "sem URL" };
  const body = JSON.stringify({ event: opts.event, sentAt: new Date().toISOString(), data: opts.data });
  let r: SendResult;
  try {
    const res = await fetch(opts.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Event": opts.event, "X-Signature": signPayload(body) },
      body,
      signal: AbortSignal.timeout(10000),
    });
    r = { status: res.ok ? "sent" : "failed", response: `${res.status} ${(await res.text()).slice(0, 300)}` };
  } catch (err) {
    r = { status: "failed", response: String(err) };
  }
  return log(opts.leadId, "webhook", new URL(opts.url).host, opts.event, r);
}
