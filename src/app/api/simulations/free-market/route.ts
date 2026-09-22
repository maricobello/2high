import { errorResponse, json } from "@/lib/api";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { db } from "@/modules/db";
import { freeMarketSimulationSchema } from "@/modules/leads/schema";
import { analyzeFreeMarket } from "@/modules/simulators/free-market";

export const runtime = "nodejs";

/** Análise preliminar pública de perfil para o Mercado Livre. */
export async function POST(req: Request) {
  try {
    if (!rateLimit(`sim:${clientIp(req)}`, 60, 60 * 60 * 1000).ok) return json({ error: "Muitas simulações. Aguarde alguns minutos." }, 429);
    const input = freeMarketSimulationSchema.parse(await req.json());
    const result = analyzeFreeMarket(input);
    const sim = await db().createSimulation({ leadId: null, kind: "free_market", input, result: result as unknown as Record<string, unknown> });
    return json({ simulationId: sim.id, result });
  } catch (err) {
    return errorResponse(err);
  }
}
