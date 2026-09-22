import "server-only";
import { env } from "@/lib/env";
import { formatBRL } from "@/lib/utils";
import { db, type LeadRecord } from "@/modules/db";
import { diagnosticUrl, emitLeadEvent } from "@/modules/crm/service";
import { generateFollowUpMessage } from "@/modules/llm/tasks/messaging";
import { isHumanHandled, SOLUTION_LABELS, stageLabel } from "@/modules/leads/types";
import { sendEmail, sendWebhook, sendWhatsApp, whatsappConfigured } from "./channels";
import { confirmationMessage, emailLayout, escapeHtml, FOLLOW_UP_STEPS, type FollowUpContext } from "./templates";

/**
 * Automação pós-diagnóstico: confirmação ao lead, alerta ao time, evento no CRM
 * e agendamento da sequência de follow-up.
 */
export async function runPostDiagnosisAutomation(lead: LeadRecord, summary: string) {
  const url = diagnosticUrl(lead);
  const hot = lead.temperature === "HOT";

  // 9. Confirmação ao lead
  const msg = confirmationMessage({ name: lead.name, protocol: lead.protocol, diagnosticUrl: url, hot });
  await Promise.allSettled([
    sendEmail({
      leadId: lead.id,
      to: lead.email,
      subject: `Seu diagnóstico preliminar de energia — protocolo ${lead.protocol}`,
      template: "confirmation",
      text: `${msg}\n\n${summary}`,
      html: emailLayout(
        "Diagnóstico preliminar disponível",
        `<p>Olá, ${escapeHtml(lead.name.split(" ")[0])}!</p><p>Recebemos sua solicitação. Protocolo: <strong>${escapeHtml(lead.protocol)}</strong>.</p><p>${escapeHtml(summary)}</p>`,
        { label: "Ver meu Raio-X de energia", url },
      ),
    }),
    whatsappConfigured()
      ? sendWhatsApp({ leadId: lead.id, phone: lead.phone, message: msg, template: "confirmation", preferTemplate: true })
      : Promise.resolve(),
  ]);

  // 11. Notificar administrador
  await notifyAdmins(lead, summary);

  // CRM externo
  await emitLeadEvent("lead.diagnosed", lead, { summary });

  // 12. Sequência de follow-up
  await scheduleFollowUps(lead);
}

export async function notifyAdmins(lead: LeadRecord, summary: string) {
  const adminUrl = `${env.appUrl}/admin/leads/${lead.id}`;
  const title = `${lead.temperature === "HOT" ? "🔥 " : ""}Novo lead ${lead.temperature ?? ""} — ${lead.company ?? lead.name} (score ${lead.score ?? "—"})`;
  const lines = [
    `Empresa: ${lead.company ?? "—"} | CNPJ: ${lead.cnpj ?? "—"}`,
    `Contato: ${lead.name} | ${lead.phone} | ${lead.email}`,
    `Local: ${[lead.city, lead.state].filter(Boolean).join("/") || "—"}`,
    `Estágio: ${stageLabel(lead.stage)} | Score: ${lead.score ?? "—"} (${lead.temperature ?? "—"})`,
    `Soluções: ${lead.recommendedSolutions.map((s) => SOLUTION_LABELS[s]).join(", ") || "—"}`,
    `Valor potencial (anual): ${formatBRL(lead.potentialValue, { cents: false })}`,
    `Resumo: ${summary}`,
  ];
  const tasks: Promise<unknown>[] = [];
  if (env.adminNotifyEmails.length) {
    tasks.push(
      sendEmail({
        leadId: lead.id,
        to: env.adminNotifyEmails,
        subject: title,
        template: "admin_new_lead",
        text: `${lines.join("\n")}\n\n${adminUrl}`,
        html: emailLayout(title, lines.map((l) => `<p style="margin:4px 0">${escapeHtml(l)}</p>`).join(""), { label: "Abrir no CRM", url: adminUrl }),
      }),
    );
  }
  if (env.adminWebhookUrl) {
    tasks.push(sendWebhook({ leadId: lead.id, url: env.adminWebhookUrl, event: "admin.new_lead", data: { text: `${title}\n${lines.join("\n")}\n${adminUrl}`, leadId: lead.id } }));
  }
  if (env.adminWhatsapp && whatsappConfigured() && lead.temperature === "HOT") {
    tasks.push(sendWhatsApp({ leadId: lead.id, phone: env.adminWhatsapp, message: `${title}\n${lines.slice(0, 5).join("\n")}\n${adminUrl}`, template: "admin_hot_lead" }));
  }
  await Promise.allSettled(tasks);
}

export async function scheduleFollowUps(lead: LeadRecord) {
  if (!env.features.followUps || lead.followUpOptOut) return;
  const existing = await db().listFollowUps(lead.id);
  if (existing.some((f) => f.status === "pending" || f.status === "sent")) return;
  const channel = whatsappConfigured() ? "whatsapp" : "email";
  const base = Date.now();
  await db().createFollowUps(
    FOLLOW_UP_STEPS.map((s) => ({
      leadId: lead.id,
      step: s.step,
      channel,
      dueAt: new Date(base + s.delayHours * 3600_000).toISOString(),
      status: "pending",
      sentAt: null,
      message: null,
    })),
  );
  await db().addActivity({
    leadId: lead.id,
    type: "system",
    channel,
    content: `Sequência de follow-up agendada (${FOLLOW_UP_STEPS.length} mensagens via ${channel}).`,
    meta: null,
    author: "sistema",
  });
}

/** Executado pelo cron (/api/cron/follow-ups). Idempotente por item. */
export async function processDueFollowUps(limit = 50) {
  const due = await db().listDueFollowUps(new Date().toISOString(), limit);
  const results = { processed: 0, sent: 0, skipped: 0, failed: 0 };
  for (const f of due) {
    results.processed++;
    const lead = await db().getLead(f.leadId);
    if (!lead || lead.followUpOptOut || isHumanHandled(lead.stage)) {
      await db().updateFollowUp(f.id, { status: "skipped" });
      results.skipped++;
      continue;
    }
    const ctx: FollowUpContext = {
      name: lead.name,
      company: lead.company,
      protocol: lead.protocol,
      diagnosticUrl: diagnosticUrl(lead),
      solutions: lead.recommendedSolutions,
      temperature: lead.temperature,
    };
    const { text, source } = await generateFollowUpMessage(f.step, ctx);
    const r =
      f.channel === "whatsapp"
        ? await sendWhatsApp({ leadId: lead.id, phone: lead.phone, message: text, template: `follow_up_${f.step}`, preferTemplate: true })
        : await sendEmail({
            leadId: lead.id,
            to: lead.email,
            subject: `Seu diagnóstico de energia — protocolo ${lead.protocol}`,
            template: `follow_up_${f.step}`,
            text,
            html: emailLayout("Diagnóstico preliminar de energia", `<p>${escapeHtml(text)}</p>`, { label: "Ver diagnóstico", url: ctx.diagnosticUrl }),
          });
    const status = r.status === "sent" ? "sent" : r.status === "skipped" ? "skipped" : "failed";
    await db().updateFollowUp(f.id, { status, sentAt: status === "sent" ? new Date().toISOString() : null, message: text });
    await db().addActivity({
      leadId: lead.id,
      type: "notification",
      channel: f.channel,
      content: `Follow-up ${f.step} (${source}) — ${status}: ${text}`,
      meta: { step: f.step, status },
      author: "automação",
    });
    results[status]++;
  }
  return results;
}
