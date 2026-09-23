import { after } from "next/server";
import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { env } from "@/lib/env";
import { safeEqual } from "@/modules/auth/session";
import { db } from "@/modules/db";
import { diagnosticUrl, publicLeadPayload } from "@/modules/crm/service";
import { intakeSimulatorLead } from "@/modules/leads/intake";
import { contactSchema } from "@/modules/leads/schema";
import { BILL_RANGES, STAGE_VALUES } from "@/modules/leads/types";
import { processLead } from "@/modules/pipeline/process-lead";

export const runtime = "nodejs";

function authorized(req: Request) {
  return Boolean(env.apiToken) && safeEqual(req.headers.get("authorization") ?? "", `Bearer ${env.apiToken}`);
}

const bodySchema = contactSchema.omit({ consent: true, website: true }).extend({
  consent: z.boolean().refine((v) => v, "Consentimento LGPD obrigatório"),
  billRange: z.enum(BILL_RANGES.map((b) => b.value) as [string, ...string[]]).optional(),
});

/** API REST para parceiros/integrações: cria lead (Bearer API_TOKEN). */
export async function POST(req: Request) {
  if (!authorized(req)) return json({ error: "Não autorizado" }, 401);
  try {
    const body = bodySchema.parse(await req.json());
    const lead = await intakeSimulatorLead({
      contact: { ...body, marketingConsent: body.marketingConsent ?? false },
      source: "gd_simulator",
      billRange: (body.billRange as never) ?? null,
      signals: [],
    });
    const patched = await db().updateLead(lead.id, { source: "api" });
    after(() => processLead(lead.id).catch((e) => console.error("[v1] processamento falhou", e)));
    return json({ lead: publicLeadPayload(patched), diagnosticUrl: diagnosticUrl(patched) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}

/** Lista leads (para BI/CRM externo). */
export async function GET(req: Request) {
  if (!authorized(req)) return json({ error: "Não autorizado" }, 401);
  try {
    const url = new URL(req.url);
    const stage = url.searchParams.get("stage");
    const rawLimit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 500) : 100;
    const leads = await db().listLeads({
      stage: stage && (STAGE_VALUES as string[]).includes(stage) ? (stage as never) : undefined,
      limit,
    });
    return json({ leads: leads.map(publicLeadPayload) });
  } catch (err) {
    return errorResponse(err);
  }
}
