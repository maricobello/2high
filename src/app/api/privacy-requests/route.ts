import { randomBytes } from "node:crypto";
import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { env } from "@/lib/env";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/modules/db";
import { sendEmail } from "@/modules/notifications/channels";
import { emailLayout, escapeHtml } from "@/modules/notifications/templates";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().pipe(z.email("E-mail inválido")),
  phone: z.string().trim().max(30).optional().nullable(),
  type: z.enum(["acesso", "correcao", "exclusao", "revogacao", "portabilidade", "informacao"]),
  message: z.string().trim().max(3000).optional().nullable(),
  website: z.string().max(0).optional().default(""),
});

const LABELS: Record<string, string> = {
  acesso: "Acesso aos dados",
  correcao: "Correção de dados",
  exclusao: "Exclusão de dados",
  revogacao: "Revogação de consentimento",
  portabilidade: "Portabilidade",
  informacao: "Informações sobre o tratamento",
};

/** Canal do titular (art. 18 LGPD). Registra, confirma ao titular e avisa o encarregado. */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`privacy:${clientIp(req)}`, 5, 60 * 60 * 1000).ok) return json({ error: "Muitas solicitações. Tente mais tarde." }, 429);
    const b = schema.parse(await req.json());
    const lead = await db().findLeadByEmail(b.email);
    const protocol = `LGPD-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(3).toString("hex").toUpperCase()}`;
    const rec = await db().createPrivacyRequest({
      protocol,
      name: b.name,
      email: b.email,
      phone: b.phone ?? null,
      type: b.type,
      message: b.message ?? null,
      status: "aberta",
      leadId: lead?.id ?? null,
      resolutionNote: null,
    });
    if (lead) {
      // Revogação: interrompe imediatamente qualquer comunicação automática
      if (b.type === "revogacao" || b.type === "exclusao") {
        await db().updateLead(lead.id, { followUpOptOut: true, marketingConsent: false });
        await db().cancelFollowUps(lead.id);
      }
      await db().addActivity({
        leadId: lead.id,
        type: "system",
        channel: "lgpd",
        content: `Solicitação LGPD ${protocol}: ${LABELS[b.type]}.`,
        meta: { requestId: rec.id },
        author: "titular",
      });
    }
    const dpo = process.env.NEXT_PUBLIC_DPO_EMAIL || env.adminNotifyEmails[0];
    await Promise.allSettled([
      sendEmail({
        leadId: lead?.id ?? null,
        to: b.email,
        subject: `Recebemos sua solicitação de privacidade — ${protocol}`,
        template: "privacy_ack",
        html: emailLayout(
          "Solicitação recebida",
          `<p>Olá, ${escapeHtml(b.name.split(" ")[0])}.</p><p>Recebemos sua solicitação de <strong>${LABELS[b.type]}</strong> (protocolo ${protocol}). Responderemos em até 15 dias, conforme a LGPD.</p>`,
        ),
      }),
      dpo
        ? sendEmail({
            leadId: lead?.id ?? null,
            to: dpo,
            subject: `[LGPD] ${LABELS[b.type]} — ${protocol}`,
            template: "privacy_dpo",
            html: emailLayout(`Nova solicitação LGPD ${protocol}`, `<p>${escapeHtml(`${b.name} <${b.email}> — ${LABELS[b.type]}`)}</p><p>${escapeHtml(b.message ?? "")}</p><p>Lead vinculado: ${lead ? "sim" : "não encontrado"}</p>`, {
              label: "Abrir painel LGPD",
              url: `${env.appUrl}/admin/lgpd`,
            }),
          })
        : Promise.resolve(),
    ]);
    return json({ protocol }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
