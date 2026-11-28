import { env } from "@/lib/env";
import { safeEqual } from "@/modules/auth/session";
import { ErroOrange } from "@/modules/orange/cliente";
import { coletar, lerConfig } from "@/modules/orange/coleta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Coleta do Orange (Vercel Cron diário do dia 6 ao 12; cada execução continua o que faltou). */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  if (!env.cronSecret || !safeEqual(auth, `Bearer ${env.cronSecret}`)) return Response.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const indice = await coletar(await lerConfig());
    return Response.json({ ok: true, competencia: indice.competencia, arquivos: indice.arquivos.length, pendentes: indice.pendentes ?? 0, erros: indice.erros.length });
  } catch (err) {
    return Response.json({ ok: false, erro: err instanceof ErroOrange ? err.message : "falha na coleta" }, { status: 200 });
  }
}
