import { env } from "@/lib/env";
import { safeEqual } from "@/modules/auth/session";
import { ErroOrange } from "@/modules/orange/cliente";
import { coletar, lerConfig } from "@/modules/orange/coleta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Coleta mensal do Orange (Vercel Cron, "Authorization: Bearer $CRON_SECRET"). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return Response.json({ error: "Não autorizado" }, { status: 401 });
  const config = await lerConfig();
  if (!config?.receitas.length || !config.usinas.length) return Response.json({ ok: false, motivo: "sem receitas configuradas" });
  try {
    const indice = await coletar(config);
    return Response.json({ ok: true, competencia: indice.competencia, arquivos: indice.arquivos.length, erros: indice.erros.length });
  } catch (err) {
    return Response.json({ ok: false, erro: err instanceof ErroOrange ? err.message : "falha na coleta" }, { status: 200 });
  }
}
