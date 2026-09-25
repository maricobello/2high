import { Flame, Gauge, Inbox, Wallet } from "lucide-react";
import { KanbanBoard, type KanbanLead } from "@/components/admin/kanban";
import { formatBRL } from "@/lib/utils";
import { db } from "@/modules/db";

export const dynamic = "force-dynamic";

function sevenDaysAgo() {
  return Date.now() - 7 * 86400_000;
}

export default async function AdminDashboard() {
  const leads = await db().listLeads({ limit: 2000 });
  const open = leads.filter((l) => l.stage !== "fechado" && l.stage !== "perdido");
  const since7d = sevenDaysAgo();
  const kpis = [
    { label: "Leads (7 dias)", value: String(leads.filter((l) => new Date(l.createdAt).getTime() >= since7d).length), icon: Inbox },
    { label: "HOT em aberto", value: String(open.filter((l) => l.temperature === "HOT").length), icon: Flame },
    {
      label: "Score médio",
      value: (() => {
        const s = leads.filter((l) => l.score !== null);
        return s.length ? String(Math.round(s.reduce((a, l) => a + (l.score ?? 0), 0) / s.length)) : "—";
      })(),
      icon: Gauge,
    },
    { label: "Comissão potencial (aberto)", value: formatBRL(open.reduce((a, l) => a + (l.potentialCommission ?? 0), 0), { cents: false }), icon: Wallet },
  ];

  const board: KanbanLead[] = leads.map((l) => ({
    id: l.id,
    protocol: l.protocol,
    name: l.name,
    company: l.company,
    stage: l.stage,
    score: l.score,
    temperature: l.temperature,
    recommendedSolutions: l.recommendedSolutions,
    potentialValue: l.potentialValue,
    processingStatus: l.processingStatus,
    source: l.source,
    createdAt: l.createdAt,
    owner: l.owner,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">{label}</p>
              <Icon className="size-4 text-primary" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular">{value}</p>
          </div>
        ))}
      </div>
      <KanbanBoard initial={board} />
    </div>
  );
}
