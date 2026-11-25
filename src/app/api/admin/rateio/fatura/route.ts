import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { lerFaturaIa } from "@/modules/llm/tasks/rateio";
import { faturaIaSchema } from "@/modules/rateio/fatura-ia";

export const runtime = "nodejs";
export const maxDuration = 60;

const entrada = z.object({ linhas: z.array(z.string().max(2000)).min(3).max(1500) });

/**
 * Lê a fatura da usina com a IA (o navegador só chama quando as regras e o layout aprendido
 * não bastam). O texto vai anonimizado; os números voltam e são conferidos no navegador.
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { linhas } = entrada.parse(await req.json());
    const r = await lerFaturaIa(linhas);
    if (!r.leitura) return json({ error: r.erro ?? "Não foi possível ler a fatura com a IA." }, 502);
    const leitura = faturaIaSchema.safeParse(r.leitura);
    if (!leitura.success) return json({ error: "A leitura da IA veio em formato inesperado." }, 502);
    return json({ leitura: leitura.data });
  } catch (err) {
    return errorResponse(err);
  }
}
