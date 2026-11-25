import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { redigirParecerRateio } from "@/modules/llm/tasks/rateio";
import { resumoParecerSchema } from "@/modules/rateio/parecer";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Redige o parecer técnico de um estudo de rateio a partir do resumo agregado. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const resumo = resumoParecerSchema.parse(await req.json());
    return json(await redigirParecerRateio(resumo));
  } catch (err) {
    return errorResponse(err);
  }
}
