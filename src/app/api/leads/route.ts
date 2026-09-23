import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { IntakeError, intakeHeroLead, type UploadedFile } from "@/modules/leads/intake";
import { heroLeadSchema } from "@/modules/leads/schema";
import { diagnosticUrl } from "@/modules/crm/service";
import { processLead } from "@/modules/pipeline/process-lead";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Recebe o formulário do hero (multipart) com a fatura.
 * Responde imediatamente com o protocolo e processa a auditoria em segundo plano.
 */
export async function POST(req: Request) {
  try {
    const rl = rateLimit(`lead:${clientIp(req)}`, 8, 60 * 60 * 1000);
    if (!rl.ok) throw new IntakeError("Muitas solicitações. Tente novamente mais tarde.", 429);

    const form = await req.formData();
    const get = (k: string) => {
      const v = form.get(k);
      return typeof v === "string" ? v : undefined;
    };
    let utm: Record<string, string> | undefined;
    try {
      utm = get("utm") ? (JSON.parse(get("utm")!) as Record<string, string>) : undefined;
    } catch {
      utm = undefined;
    }

    const input = heroLeadSchema.parse({
      name: get("name"),
      company: get("company"),
      cnpj: get("cnpj"),
      phone: get("phone"),
      email: get("email"),
      state: get("state"),
      city: get("city"),
      billRange: get("billRange"),
      solarStatus: get("solarStatus"),
      freeMarketStatus: get("freeMarketStatus"),
      consent: get("consent") === "true",
      marketingConsent: get("marketingConsent") === "true",
      website: get("website") ?? "",
      utm,
    });

    const f = form.get("file");
    let file: UploadedFile | null = null;
    if (f && typeof f !== "string" && f.size > 0) {
      file = { name: f.name, type: f.type, bytes: Buffer.from(await f.arrayBuffer()) };
    }
    if (!file) throw new IntakeError("Envie a fatura em PDF ou imagem.");

    const lead = await intakeHeroLead(input, file);

    after(async () => {
      try {
        await processLead(lead.id);
      } catch (err) {
        console.error("[leads] processamento falhou", err);
      }
    });

    return json({ protocol: lead.protocol, token: lead.accessToken, diagnosticUrl: diagnosticUrl(lead) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
