import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { clienteLogado, credenciaisConfiguradas, ErroOrange } from "@/modules/orange/cliente";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Credenciais configuradas? (GET) · Testa o login no Orange (POST). Nunca devolve a senha. */
export async function GET() {
  try {
    await requireAdmin();
    return json({ configurado: await credenciaisConfiguradas() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST() {
  try {
    await requireAdmin();
    const t0 = Date.now();
    await clienteLogado();
    return json({ ok: true, ms: Date.now() - t0 });
  } catch (err) {
    if (err instanceof ErroOrange) return json({ ok: false, erro: err.message }, { status: 200 });
    return errorResponse(err);
  }
}
