import { errorResponse, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/modules/db";
import { gdSimulationSchema } from "@/modules/leads/schema";
import { simulateGd } from "@/modules/simulators/gd";

export const runtime = "nodejs";

/** Simulação pública de GD por assinatura (sem necessidade de cadastro). */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`sim:${clientIp(req)}`, 60, 60 * 60 * 1000).ok) return json({ error: "Muitas simulações. Aguarde alguns minutos." }, 429);
    const input = gdSimulationSchema.parse(await req.json());
    const result = simulateGd({ ...input, monthlyBill: input.monthlyBill ?? null });
    const sim = await db().createSimulation({ leadId: null, kind: "gd", input, result: result as unknown as Record<string, unknown> });
    return json({ simulationId: sim.id, result });
  } catch (err) {
    return errorResponse(err);
  }
}
