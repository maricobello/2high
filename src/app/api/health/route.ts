import { env } from "@/lib/env";
import { getLLM } from "@/modules/llm/provider";
import { whatsappConfigured } from "@/modules/notifications/channels";

export const dynamic = "force-dynamic";

/** Status das integrações (sem expor segredos). */
export async function GET() {
  return Response.json({
    ok: true,
    dataDriver: env.dataDriver,
    llm: getLLM().available ? env.llmProvider : "desativado",
    ocrExterno: Boolean(env.ocrSpaceApiKey),
    email: Boolean(env.resendApiKey),
    whatsapp: whatsappConfigured() ? env.whatsappProvider : "desativado",
    crmWebhook: Boolean(env.crmWebhookUrl),
    followUps: env.features.followUps,
    modules: { auditoria: true, gd: true, mercadoLivre: true, antecipacao: env.features.advance },
  });
}
