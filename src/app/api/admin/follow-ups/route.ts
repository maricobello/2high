import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { processDueFollowUps } from "@/modules/notifications/automation";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Dispara manualmente o processamento de follow-ups vencidos. */
export async function POST() {
  try {
    await requireAdmin();
    return json(await processDueFollowUps(100));
  } catch (err) {
    return errorResponse(err);
  }
}
