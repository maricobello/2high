import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { ErroOrange } from "@/modules/orange/cliente";
import { coletar, gravarConfig, lerConfig, ultimaColeta } from "@/modules/orange/coleta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Configuração das receitas e a última coleta. */
export async function GET() {
  try {
    await requireAdmin();
    const [config, ultima] = await Promise.all([lerConfig(), ultimaColeta()]);
    return json({ config, ultima });
  } catch (err) {
    return errorResponse(err);
  }
}

const caminho = z.string().regex(/^\/[\w\-/{}.]+(\?[\w=&%\-.{}/]*)?$/).max(300);
const configSchema = z.object({
  receitas: z.array(z.object({ tipo: z.enum(["ucs", "relatorio", "energia", "fatura"]), nome: z.string().max(80), caminho, metodo: z.enum(["GET", "POST"]), campos: z.record(z.string().max(60), z.string().max(200)).optional() })).max(10),
  usinas: z.array(z.object({ id: z.string().max(60), nome: z.string().max(120) })).max(400),
});

/** Salva as receitas e a lista de usinas a coletar. */
export async function PUT(req: Request) {
  try {
    await requireAdmin();
    const c = configSchema.parse(await req.json());
    await gravarConfig({ ...c, atualizadoEm: new Date().toISOString() });
    return json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Roda a coleta agora (competência AAAA-MM opcional). */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { competencia } = z.object({ competencia: z.string().regex(/^\d{4}-\d{2}$/).optional() }).parse(await req.json().catch(() => ({})));
    const config = await lerConfig();
    if (!config?.receitas.length || !config.usinas.length) return json({ ok: false, erro: "O robô ainda não sabe o que baixar: falta o mapa das telas do Orange (Integrações › Robô do Orange)." });
    const indice = await coletar(config, competencia);
    return json({ ok: true, indice });
  } catch (err) {
    if (err instanceof ErroOrange) return json({ ok: false, erro: err.message });
    return errorResponse(err);
  }
}
