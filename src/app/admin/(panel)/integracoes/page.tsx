import { CheckCircle2, CircleDashed } from "lucide-react";
import { RunFollowUps } from "@/components/admin/run-followups";
import { env } from "@/lib/env";
import { getLLM } from "@/modules/llm/provider";
import { whatsappConfigured } from "@/modules/notifications/channels";
import { ENGINE_VERSION } from "@/modules/rules-engine/parameters";

export const dynamic = "force-dynamic";

export default function IntegrationsPage() {
  const items = [
    { name: "Banco de dados", ok: env.dataDriver === "supabase", detail: env.dataDriver === "supabase" ? "Supabase/PostgreSQL" : "Local (somente desenvolvimento)" },
    { name: "IA (extração, explicação, intenção, follow-up)", ok: getLLM().available, detail: getLLM().available ? `${env.llmProvider} · ${env.llmModelText} / ${env.llmModelFast} / ${env.llmModelVision}` : "Desativada — usando apenas regras e templates" },
    { name: "OCR externo (PDF digitalizado)", ok: Boolean(env.ocrSpaceApiKey), detail: env.ocrSpaceApiKey ? "OCR.space" : "PDFs com texto são lidos nativamente; imagens via IA de visão" },
    { name: "E-mail", ok: Boolean(env.resendApiKey), detail: env.resendApiKey ? `Resend · ${env.emailFrom}` : "RESEND_API_KEY não configurada" },
    { name: "WhatsApp (envio)", ok: whatsappConfigured(), detail: whatsappConfigured() ? env.whatsappProvider : "WHATSAPP_PROVIDER não configurado" },
    { name: "WhatsApp (recebimento)", ok: Boolean(env.metaWhatsappVerifyToken || env.whatsappWebhookToken), detail: `${env.appUrl}/api/webhooks/whatsapp` },
    { name: "Webhook CRM externo", ok: Boolean(env.crmWebhookUrl), detail: env.crmWebhookUrl ? new URL(env.crmWebhookUrl).host : "CRM_WEBHOOK_URL não configurada" },
    { name: "Alerta do time (webhook)", ok: Boolean(env.adminWebhookUrl), detail: env.adminWebhookUrl ? new URL(env.adminWebhookUrl).host : "ADMIN_WEBHOOK_URL (Slack, n8n…)" },
    { name: "API REST (/api/v1/leads)", ok: Boolean(env.apiToken), detail: env.apiToken ? "Protegida por API_TOKEN" : "API_TOKEN não configurado" },
    { name: "Cron de follow-up", ok: Boolean(env.cronSecret), detail: "/api/cron/follow-ups (Vercel Cron)" },
    { name: "Dados ANEEL", ok: Boolean(env.aneelTariffResourceId), detail: env.aneelTariffResourceId ? "Tarifas homologadas (dados abertos)" : "ANEEL_TARIFF_RESOURCE_ID opcional" },
  ];
  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border bg-white p-5">
        <h1 className="font-semibold">Integrações e automação</h1>
        <p className="mt-1 text-sm text-muted">Motor de regras v{ENGINE_VERSION}. Módulo de antecipação: {env.features.advance ? "ativo" : "desativado (previsto)"}.</p>
        <ul className="mt-5 divide-y divide-border">
          {items.map((i) => (
            <li key={i.name} className="flex items-start gap-3 py-3">
              {i.ok ? <CheckCircle2 className="mt-0.5 size-4 text-opportunity" /> : <CircleDashed className="mt-0.5 size-4 text-muted" />}
              <div>
                <p className="text-sm font-medium">{i.name}</p>
                <p className="text-xs text-muted">{i.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="rounded-2xl border border-border bg-white p-5">
        <RunFollowUps />
      </section>
    </div>
  );
}
