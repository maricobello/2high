import { z } from "zod";
import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { clienteLogado, ErroOrange } from "@/modules/orange/cliente";
import { competenciaAnterior, filtrarUsinas } from "@/modules/orange/coleta";
import { gerencialDaUsina, listarUsinas, planilhaGerencial, planilhaUcs, ucsDoRateio } from "@/modules/orange/gd";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const corpo = z.object({
  competencia: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  usinas: z.array(z.string().min(2).max(120)).min(1).max(30),
});

const nomeArq = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(0, 80);

/**
 * Busca direto no Orange, na hora, as UCs do rateio e o Relatório Gerencial das usinas pedidas
 * e devolve as planilhas ao navegador (não depende do banco do site).
 */
export async function POST(req: Request) {
  try {
    await requireAdmin();
    const { competencia = competenciaAnterior(), usinas: nomes } = corpo.parse(await req.json());
    const inicio = Date.now();
    const c = await clienteLogado();
    const todas = await listarUsinas(c);
    const usinas = filtrarUsinas(todas, nomes).slice(0, 30);
    if (!usinas.length) return json({ ok: false, erro: `Nenhuma usina do Orange bate com: ${nomes.join(", ")}.` });
    const arquivos: { nome: string; base64: string }[] = [];
    const erros: string[] = [];
    const ucs = await ucsDoRateio(c, usinas, competencia);
    for (const u of usinas) {
      const daUsina = ucs.filter((x) => x.usinaId === u.id);
      if (daUsina.length) arquivos.push({ nome: `${nomeArq(u.nome)}_ucs_${competencia}.xlsx`, base64: (await planilhaUcs(daUsina)).toString("base64") });
      else erros.push(`${u.nome}: nenhuma UC no rateio do Orange em ${competencia}.`);
    }
    const gerencial = [];
    for (const u of usinas) {
      if (Date.now() - inicio > 45_000) {
        erros.push(`${u.nome}: Relatório Gerencial não lido (tempo esgotado; peça menos usinas por vez).`);
        continue;
      }
      try {
        const { linhas, ...g } = await gerencialDaUsina(c, u, competencia);
        gerencial.push(g);
        if (linhas.length) arquivos.push({ nome: `${nomeArq(u.nome)}_relatorio_${competencia}.xlsx`, base64: (await planilhaGerencial(u.nome, competencia, linhas)).toString("base64") });
        else if (g.status === "nao_processado") erros.push(`${u.nome}: Relatório Gerencial de ${competencia} ainda não processado no Orange.`);
      } catch (e) {
        erros.push(`${u.nome} · Relatório Gerencial: ${e instanceof Error ? e.message : "falha"}`);
      }
    }
    return json({ ok: true, competencia, usinas: usinas.map((u) => u.nome), arquivos, gerencial, erros });
  } catch (err) {
    if (err instanceof ErroOrange) return json({ ok: false, erro: err.message });
    return errorResponse(err);
  }
}
