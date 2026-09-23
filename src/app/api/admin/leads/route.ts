import { errorResponse, json } from "@/lib/api";
import { requireAdmin } from "@/modules/auth/admin";
import { db } from "@/modules/db";
import { SOLUTION_LABELS, STAGE_VALUES, stageLabel, type Stage, type Temperature } from "@/modules/leads/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireAdmin();
    const url = new URL(req.url);
    const stage = url.searchParams.get("stage");
    const temp = url.searchParams.get("temperature");
    const leads = await db().listLeads({
      stage: stage && (STAGE_VALUES as string[]).includes(stage) ? (stage as Stage) : undefined,
      temperature: temp === "HOT" || temp === "WARM" || temp === "COLD" ? (temp as Temperature) : undefined,
      q: url.searchParams.get("q") ?? undefined,
      limit: 2000,
    });
    if (url.searchParams.get("format") === "csv") {
      const header = ["protocolo", "criado_em", "nome", "empresa", "cnpj", "telefone", "email", "uf", "cidade", "origem", "estagio", "score", "temperatura", "solucoes", "valor_potencial", "comissao_potencial", "responsavel"];
      // Neutraliza fórmulas (CSV/Formula injection) antes de escapar aspas
      const esc = (v: unknown) => {
        let t = String(v ?? "");
        if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
        return `"${t.replace(/"/g, '""')}"`;
      };
      const rows = leads.map((l) =>
        [
          l.protocol,
          l.createdAt,
          l.name,
          l.company,
          l.cnpj,
          l.phone,
          l.email,
          l.state,
          l.city,
          l.source,
          stageLabel(l.stage),
          l.score,
          l.temperature,
          l.recommendedSolutions.map((s) => SOLUTION_LABELS[s]).join(" | "),
          l.potentialValue,
          l.potentialCommission,
          l.owner,
        ]
          .map(esc)
          .join(";"),
      );
      return new Response("﻿" + [header.join(";"), ...rows].join("\n"), {
        headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"` },
      });
    }
    return json({ leads });
  } catch (err) {
    return errorResponse(err);
  }
}
