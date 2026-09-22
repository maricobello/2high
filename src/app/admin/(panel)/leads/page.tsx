import { Download } from "lucide-react";
import Link from "next/link";
import { TemperatureBadge } from "@/components/admin/kanban";
import { formatBRL, formatDateTime } from "@/lib/utils";
import { db } from "@/modules/db";
import { SOLUTION_LABELS, STAGES, STAGE_VALUES, stageLabel, type Stage, type Temperature } from "@/modules/leads/types";

export const dynamic = "force-dynamic";

export default async function LeadsPage(props: PageProps<"/admin/leads">) {
  const sp = await props.searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const q = one(sp.q);
  const stage = one(sp.stage);
  const temperature = one(sp.temperature);
  const leads = await db().listLeads({
    q: q || undefined,
    stage: (STAGE_VALUES as string[]).includes(stage) ? (stage as Stage) : undefined,
    temperature: ["HOT", "WARM", "COLD"].includes(temperature) ? (temperature as Temperature) : undefined,
    limit: 1000,
  });
  const csv = `/api/admin/leads?format=csv&q=${encodeURIComponent(q)}&stage=${stage}&temperature=${temperature}`;

  return (
    <div className="space-y-4">
      <form className="flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Buscar nome, empresa, e-mail, CNPJ, protocolo" className="h-9 w-80 rounded-lg border border-border bg-white px-3 text-sm" />
        <select name="stage" defaultValue={stage} className="h-9 rounded-lg border border-border bg-white px-2 text-sm">
          <option value="">Todos os estágios</option>
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select name="temperature" defaultValue={temperature} className="h-9 rounded-lg border border-border bg-white px-2 text-sm">
          <option value="">Todas temperaturas</option>
          <option>HOT</option>
          <option>WARM</option>
          <option>COLD</option>
        </select>
        <button className="h-9 rounded-lg bg-foreground px-4 text-sm font-semibold text-white">Filtrar</button>
        <a href={csv} className="ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-sm font-medium">
          <Download className="size-4" /> Exportar CSV
        </a>
      </form>
      <div className="overflow-x-auto rounded-2xl border border-border bg-white">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="border-b border-border bg-subtle/60 text-left text-xs uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3">Empresa / contato</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Estágio</th>
              <th className="px-4 py-3">Soluções</th>
              <th className="px-4 py-3 text-right">Valor potencial</th>
              <th className="px-4 py-3 text-right">Comissão</th>
              <th className="px-4 py-3">Origem</th>
              <th className="px-4 py-3">Criado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leads.map((l) => (
              <tr key={l.id} className="hover:bg-subtle/40">
                <td className="px-4 py-3">
                  <Link href={`/admin/leads/${l.id}`} className="font-semibold hover:text-primary">
                    {l.company || l.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {l.name} · {l.protocol}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <TemperatureBadge t={l.temperature} score={l.score} />
                </td>
                <td className="px-4 py-3">{stageLabel(l.stage)}</td>
                <td className="px-4 py-3 text-xs">{l.recommendedSolutions.map((s) => SOLUTION_LABELS[s]).join(", ") || "—"}</td>
                <td className="px-4 py-3 text-right tabular">{formatBRL(l.potentialValue, { cents: false })}</td>
                <td className="px-4 py-3 text-right tabular">{formatBRL(l.potentialCommission, { cents: false })}</td>
                <td className="px-4 py-3 text-xs text-muted">{l.source}</td>
                <td className="px-4 py-3 text-xs text-muted">{formatDateTime(l.createdAt)}</td>
              </tr>
            ))}
            {!leads.length && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-muted">
                  Nenhum lead encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
