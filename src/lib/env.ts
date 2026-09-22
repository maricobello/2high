import "server-only";

/**
 * Configuração do servidor. NUNCA importe este arquivo em componentes client:
 * o pacote "server-only" quebra o build se isso acontecer, protegendo as chaves.
 */
const e = process.env;

const bool = (v: string | undefined, fallback = false) => (v === undefined || v === "" ? fallback : v === "true" || v === "1");

export const env = {
  nodeEnv: e.NODE_ENV ?? "development",
  isVercel: Boolean(e.VERCEL),
  appUrl: (e.NEXT_PUBLIC_APP_URL || (e.VERCEL_URL ? `https://${e.VERCEL_URL}` : "http://localhost:3000")).replace(/\/$/, ""),

  // Banco / storage
  supabaseUrl: e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL || "",
  supabaseServiceRoleKey: e.SUPABASE_SERVICE_ROLE_KEY || "",
  storageBucket: e.SUPABASE_STORAGE_BUCKET || "invoices",
  /** "supabase" em produção; "local" grava em .data/ (apenas desenvolvimento). */
  dataDriver: (e.DATA_DRIVER || (e.SUPABASE_URL || e.NEXT_PUBLIC_SUPABASE_URL ? "supabase" : "local")) as "supabase" | "local",
  localDataDir: e.LOCAL_DATA_DIR || (e.VERCEL ? "/tmp/.data" : ".data"),

  // IA (Groq por padrão; camada desacoplada em src/modules/llm)
  llmProvider: (e.LLM_PROVIDER || (e.GROQ_API_KEY ? "groq" : "none")) as "groq" | "openai_compatible" | "none",
  groqApiKey: e.GROQ_API_KEY || "",
  llmBaseUrl: e.LLM_BASE_URL || "https://api.groq.com/openai/v1",
  llmApiKey: e.LLM_API_KEY || e.GROQ_API_KEY || "",
  llmModelText: e.LLM_MODEL_TEXT || "llama-3.3-70b-versatile",
  llmModelFast: e.LLM_MODEL_FAST || "llama-3.1-8b-instant",
  llmModelVision: e.LLM_MODEL_VISION || "meta-llama/llama-4-scout-17b-16e-instruct",
  llmTimeoutMs: Number(e.LLM_TIMEOUT_MS || 25000),

  // OCR externo opcional (PDF digitalizado / imagens)
  ocrSpaceApiKey: e.OCR_SPACE_API_KEY || "",

  // Admin
  adminEmail: (e.ADMIN_EMAIL || "").toLowerCase(),
  adminPassword: e.ADMIN_PASSWORD || "",
  authSecret: e.AUTH_SECRET || "",

  // Notificações
  resendApiKey: e.RESEND_API_KEY || "",
  emailFrom: e.EMAIL_FROM || "Diagnóstico <onboarding@resend.dev>",
  adminNotifyEmails: (e.ADMIN_NOTIFY_EMAILS || e.ADMIN_EMAIL || "").split(",").map((s) => s.trim()).filter(Boolean),
  whatsappProvider: (e.WHATSAPP_PROVIDER || "none") as "meta" | "webhook" | "none",
  metaWhatsappToken: e.META_WHATSAPP_TOKEN || "",
  metaWhatsappPhoneNumberId: e.META_WHATSAPP_PHONE_NUMBER_ID || "",
  metaWhatsappVerifyToken: e.META_WHATSAPP_VERIFY_TOKEN || "",
  metaWhatsappTemplate: e.META_WHATSAPP_TEMPLATE || "",
  metaWhatsappTemplateLang: e.META_WHATSAPP_TEMPLATE_LANG || "pt_BR",
  whatsappWebhookUrl: e.WHATSAPP_WEBHOOK_URL || "",
  whatsappWebhookToken: e.WHATSAPP_WEBHOOK_TOKEN || "",
  adminWhatsapp: (e.ADMIN_WHATSAPP || "").replace(/\D/g, ""),

  // Webhooks de saída (CRM externo, n8n, Make, Slack etc.)
  crmWebhookUrl: e.CRM_WEBHOOK_URL || "",
  adminWebhookUrl: e.ADMIN_WEBHOOK_URL || "",
  webhookSigningSecret: e.WEBHOOK_SIGNING_SECRET || "",
  /** Token para chamadas de entrada na API pública (/api/v1). */
  apiToken: e.API_TOKEN || "",

  // Cron
  cronSecret: e.CRON_SECRET || "",

  // Integrações de dados
  aneelTariffResourceId: e.ANEEL_TARIFF_RESOURCE_ID || "",

  // Feature flags
  features: {
    /** Módulo 4 — Antecipação de benefício econômico. Desativado no MVP. */
    advance: bool(e.FEATURE_ADVANCE_ENABLED, false),
    followUps: bool(e.FEATURE_FOLLOW_UPS_ENABLED, true),
  },
};

export function assertProductionConfig(): string[] {
  const missing: string[] = [];
  if (env.dataDriver === "supabase" && (!env.supabaseUrl || !env.supabaseServiceRoleKey)) missing.push("SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY");
  if (!env.adminPassword || !env.authSecret) missing.push("ADMIN_PASSWORD/AUTH_SECRET");
  if (env.llmProvider === "none") missing.push("GROQ_API_KEY (IA desativada — usando apenas regras)");
  return missing;
}
