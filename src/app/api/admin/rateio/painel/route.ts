import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { lerPainelImagem } from "@/modules/llm/tasks/rateio";
import { painelIaSchema } from "@/modules/rateio/painel";

export const runtime = "nodejs";
export const maxDuration = 60;

const entrada = z.object({
  // recorte da tela: só imagem, até ~4 MB
  imagem: z
    .string()
    .max(5_600_000)
    .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Envie uma imagem PNG, JPG ou WEBP"),
});

/** Lê o bloco "Energia" da tela de usinas do Orange a partir de um recorte (imagem). */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { imagem } = entrada.parse(await req.json());
    const r = await lerPainelImagem(imagem);
    if (!r.valores) return json({ error: r.erro ?? "Não foi possível ler a imagem." }, 502);
    const valores = painelIaSchema.safeParse(r.valores);
    if (!valores.success) return json({ error: "A leitura veio em formato inesperado. Tente colar o texto da tela." }, 502);
    return json({ valores: Object.fromEntries(Object.entries(valores.data).filter(([, v]) => typeof v === "number")) });
  } catch (err) {
    return errorResponse(err);
  }
}
