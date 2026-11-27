import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { clienteLogado, ErroOrange } from "@/modules/orange/cliente";
import { mapearOrange } from "@/modules/orange/mapear";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const corpo = z.object({ extras: z.array(z.string().regex(/^\/[\w\-/]+(\?[\w=&%\-.]*)?$/).max(200)).max(10).default([]) });

/** Entra no Orange e devolve a estrutura das telas de GD (sem dados de cliente nem tokens). */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { extras } = corpo.parse(await req.json().catch(() => ({})));
    const c = await clienteLogado();
    const mapa = await mapearOrange(c, extras);
    return json({ ok: true, geradoEm: new Date().toISOString(), ...mapa });
  } catch (err) {
    if (err instanceof ErroOrange) return json({ ok: false, erro: err.message }, { status: 200 });
    return errorResponse(err);
  }
}
