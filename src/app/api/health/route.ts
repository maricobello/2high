import { env } from "@/lib/env";
import { getSecret } from "@/lib/secrets";
import { db } from "@/modules/db";
import { getLLM } from "@/modules/llm/provider";
import { whatsappConfigured } from "@/modules/notifications/channels";

export const dynamic = "force-dynamic";

/** Status das integrações (sem expor segredos). */
export async function GET() {
  let database: "ok" | string = "ok";
  try {
    await db().listPartners();
  } catch (err) {
    database = `erro: ${err instanceof Error ? err.message.slice(0, 160) : "desconhecido"}`;
  }
  const llmKey = getLLM().available ? Boolean(await getSecret("GROQ_API_KEY").catch(() => null)) || Boolean(env.llmApiKey) : false;
  return Response.json({
    ok: database === "ok",
    dataDriver: env.dataDriver,
    database,
    llm: llmKey ? env.llmProvider === "none" ? "groq" : env.llmProvider : "desativado",
    admin: Boolean(env.adminEmail && env.adminPassword && env.authSecret),
    ocrExterno: Boolean(env.ocrSpaceApiKey),
    email: Boolean(env.resendApiKey),
    whatsapp: whatsappConfigured() ? env.whatsappProvider : "desativado",
    crmWebhook: Boolean(env.crmWebhookUrl),
    followUps: env.features.followUps,
    modules: { auditoria: true, gd: true, mercadoLivre: true, antecipacao: env.features.advance },
  });
}
