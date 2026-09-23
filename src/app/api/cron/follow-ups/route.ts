import { env } from "@/lib/env";
import { safeEqual } from "@/modules/auth/session";
import { processDueFollowUps } from "@/modules/notifications/automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Processa follow-ups vencidos. Chamado pelo Vercel Cron (envia
 * "Authorization: Bearer $CRON_SECRET") ou por qualquer agendador externo.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) {
    return Response.json({ error: "Não autorizado" }, { status: 401 });
  }
  const result = await processDueFollowUps(100);
  return Response.json({ ok: true, ...result });
}
