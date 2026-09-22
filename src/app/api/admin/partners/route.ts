import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/modules/db";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireAdmin();
    return json({ partners: await db().listPartners() });
  } catch (err) {
    return errorResponse(err);
  }
}

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  kind: z.enum(["comercializadora", "gd", "consultoria", "representante", "outro"]),
  contactEmail: z.string().trim().max(160).nullable().optional(),
  contactPhone: z.string().trim().max(40).nullable().optional(),
  commissionRate: z.number().min(0).max(1).nullable().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
    const b = schema.parse(await req.json());
    const partner = await db().createPartner({
      name: b.name,
      kind: b.kind,
      contactEmail: b.contactEmail ?? null,
      contactPhone: b.contactPhone ?? null,
      commissionRate: b.commissionRate ?? null,
      active: true,
    });
    return json({ partner }, 201);
  } catch (err) {
    return errorResponse(err);
  }
}
