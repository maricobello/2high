import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/modules/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return json({ requests: await db().listPrivacyRequests() });
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({ id: z.string(), status: z.enum(["aberta", "em_andamento", "concluida", "recusada"]), resolutionNote: z.string().max(2000).optional() });

export async function PATCH(req: Request) {
  try {
    await requireAdmin();
    const b = schema.parse(await req.json());
    const done = b.status === "concluida" || b.status === "recusada";
    const r = await db().updatePrivacyRequest(b.id, { status: b.status, resolutionNote: b.resolutionNote ?? null, resolvedAt: done ? new Date().toISOString() : null });
    return json({ request: r });
  } catch (err) {
    return errorResponse(err);
  }
}
