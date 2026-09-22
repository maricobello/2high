import { after } from "next/server";
import { errorResponse, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/modules/db";
import { diagnosticUrl } from "@/modules/crm/service";
import { billRangeFromAmount, IntakeError, intakeSimulatorLead } from "@/modules/leads/intake";
import { freeMarketSimulationSchema, gdSimulationSchema, simulatorLeadSchema } from "@/modules/leads/schema";
import { processLead } from "@/modules/pipeline/process-lead";
import { analyzeFreeMarket } from "@/modules/simulators/free-market";
import { simulateGd } from "@/modules/simulators/gd";

export const runtime = "nodejs";
export const maxDuration = 60;

/** CTA dos simuladores ("Quero receber uma proposta" / "Quero uma análise comercial"). */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`lead:${clientIp(req)}`, 8, 60 * 60 * 1000).ok) throw new IntakeError("Muitas solicitações. Tente novamente mais tarde.", 429);
    const body = simulatorLeadSchema.parse(await req.json());

    let simInput: Record<string, unknown>;
    let result: Record<string, unknown>;
    let amount: number | null = null;
    if (body.kind === "gd") {
      const input = gdSimulationSchema.parse(body.simulation);
      simInput = input;
      amount = input.monthlyBill ?? null;
      result = simulateGd({ ...input, monthlyBill: input.monthlyBill ?? null }) as unknown as Record<string, unknown>;
    } else {
      const input = freeMarketSimulationSchema.parse(body.simulation);
      simInput = input;
      amount = input.monthlyBill ?? null;
      result = analyzeFreeMarket(input) as unknown as Record<string, unknown>;
    }

    const lead = await intakeSimulatorLead({
      contact: body,
      source: body.kind === "gd" ? "gd_simulator" : "ml_simulator",
      billRange: billRangeFromAmount(amount),
      signals: body.kind === "gd" ? ["used_gd_simulator", "requested_gd_proposal"] : ["used_ml_simulator", "requested_ml_analysis"],
    });
    await db().createSimulation({ leadId: lead.id, kind: body.kind, input: simInput, result });
    await db().addActivity({
      leadId: lead.id,
      type: "simulation",
      channel: body.kind,
      content: body.kind === "gd" ? "Solicitou proposta de GD por assinatura pelo simulador." : "Solicitou análise comercial de Mercado Livre pelo simulador.",
      meta: { input: simInput },
      author: "lead",
    });

    after(async () => {
      try {
        await processLead(lead.id);
      } catch (err) {
        console.error("[sim-lead] processamento falhou", err);
      }
    });

    return json({ protocol: lead.protocol, token: lead.accessToken, diagnosticUrl: diagnosticUrl(lead) }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
