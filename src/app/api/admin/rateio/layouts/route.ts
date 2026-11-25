import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { juntarLayouts, type LayoutFatura } from "@/modules/rateio/layout";
import { storage } from "@/modules/storage";

export const runtime = "nodejs";

/** Layouts aprendidos de fatura (só rótulos, sem dados de cliente), num arquivo do armazenamento privado. */
const CHAVE = "rateio/layouts-fatura.json";

async function ler(): Promise<LayoutFatura[]> {
  try {
    const buf = await storage().read(CHAVE);
    const j = JSON.parse(buf.toString("utf8")) as { layouts?: LayoutFatura[] };
    return Array.isArray(j.layouts) ? j.layouts : [];
  } catch {
    return [];
  }
}

async function gravar(layouts: LayoutFatura[]) {
  const s = storage();
  await s.remove(CHAVE).catch(() => {});
  await s.save(CHAVE, Buffer.from(JSON.stringify({ layouts }), "utf8"), "application/json");
}

const rotulos = z.array(z.array(z.string().max(80)).max(4)).max(3);
const layoutSchema = z.object({
  distribuidora: z.string().max(60),
  campos: z.record(z.string().max(40), rotulos),
  leituras: z.number().int().min(0),
  leiturasIa: z.number().int().min(0),
  atualizadoEm: z.string().max(40),
});

export async function GET() {
  try {
    await requireAdmin();
    return json({ layouts: await ler() });
  } catch (err) {
    return errorResponse(err);
  }
}

/** Salva (junta) o layout aprendido de uma distribuidora. */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { layout } = z.object({ layout: layoutSchema }).parse(await req.json());
    const todos = await ler();
    const i = todos.findIndex((l) => l.distribuidora === layout.distribuidora);
    const novo = i >= 0 ? juntarLayouts(layout as LayoutFatura, todos[i]) : (layout as LayoutFatura);
    if (i >= 0) todos[i] = novo;
    else todos.push(novo);
    await gravar(todos.slice(0, 100));
    return json({ layout: novo });
  } catch (err) {
    return errorResponse(err);
  }
}
