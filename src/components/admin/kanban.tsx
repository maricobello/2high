"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { cn, formatBRL } from "@/lib/utils";
import { STAGES, type SolutionCode, type Stage, type Temperature } from "@/modules/leads/types";

export interface KanbanLead {
  id: string;
  protocol: string;
  name: string;
  company: string | null;
  stage: Stage;
  score: number | null;
  temperature: Temperature | null;
  recommendedSolutions: SolutionCode[];
  potentialValue: number | null;
  processingStatus: string;
  source: string;
  createdAt: string;
  owner: string | null;
}

const SOL_SHORT: Record<SolutionCode, string> = { auditoria: "Auditoria", gd_assinatura: "GD", mercado_livre: "ML", antecipacao: "Antecip." };

export function TemperatureBadge({ t, score }: { t: Temperature | null; score?: number | null }) {
  if (!t) return <span className="rounded-md bg-subtle px-1.5 py-0.5 text-[10px] font-bold text-muted">—</span>;
  const cls = t === "HOT" ? "bg-attention text-white" : t === "WARM" ? "bg-analysis text-primary-foreground" : "bg-subtle text-muted";
  return (
    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular", cls)}>
      {t}
      {score !== undefined && score !== null ? ` · ${score}` : ""}
    </span>
  );
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))} min`;
  if (diff < 86400) return `${Math.round(diff / 3600)} h`;
  return `${Math.round(diff / 86400)} d`;
}

export function KanbanBoard({ initial }: { initial: KanbanLead[] }) {
  const [leads, setLeads] = useState(initial);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<Stage | null>(null);
  const [q, setQ] = useState("");
  const [temp, setTemp] = useState<"" | Temperature>("");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      leads.filter(
        (l) =>
          (!temp || l.temperature === temp) &&
          (!q || [l.name, l.company, l.protocol].some((v) => v?.toLowerCase().includes(q.toLowerCase()))),
      ),
    [leads, q, temp],
  );

  async function move(id: string, stage: Stage) {
    const prev = leads;
    const lead = leads.find((l) => l.id === id);
    if (!lead || lead.stage === stage) return;
    setLeads((ls) => ls.map((l) => (l.id === id ? { ...l, stage } : l)));
    const res = await fetch(`/api/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stage }) });
    if (!res.ok) {
      setLeads(prev);
      setError("Não foi possível mover o lead.");
      setTimeout(() => setError(null), 3000);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar empresa, nome, protocolo"
            className="h-9 w-72 rounded-lg border border-border bg-card pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
          />
        </div>
        {(["", "HOT", "WARM", "COLD"] as const).map((t) => (
          <button
            key={t || "all"}
            onClick={() => setTemp(t)}
            className={cn("h-9 rounded-lg border px-3 text-xs font-semibold", temp === t ? "border-foreground bg-foreground text-background" : "border-border bg-card text-muted")}
          >
            {t || "Todos"}
          </button>
        ))}
        {error && <span className="text-sm font-medium text-attention">{error}</span>}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((s) => {
          const col = filtered.filter((l) => l.stage === s.value);
          const total = col.reduce((a, l) => a + (l.potentialValue ?? 0), 0);
          return (
            <div
              key={s.value}
              onDragOver={(e) => {
                e.preventDefault();
                setOver(s.value);
              }}
              onDragLeave={() => setOver((o) => (o === s.value ? null : o))}
              onDrop={(e) => {
                e.preventDefault();
                setOver(null);
                if (dragId) void move(dragId, s.value);
                setDragId(null);
              }}
              className={cn("flex w-64 shrink-0 flex-col rounded-2xl border bg-subtle/60 transition-colors", over === s.value ? "border-primary bg-primary-soft" : "border-transparent")}
            >
              <div className="px-3 pb-2 pt-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-foreground/70">{s.label}</p>
                  <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold tabular text-muted">{col.length}</span>
                </div>
                {total > 0 && <p className="mt-0.5 text-[11px] text-muted tabular">{formatBRL(total, { cents: false })}/ano</p>}
              </div>
              <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
                {col.map((l) => (
                  <Link
                    key={l.id}
                    href={`/admin/leads/${l.id}`}
                    draggable
                    onDragStart={() => setDragId(l.id)}
                    onDragEnd={() => setDragId(null)}
                    className={cn(
                      "block rounded-xl border border-border bg-card p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
                      dragId === l.id && "opacity-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-1 text-sm font-semibold">{l.company || l.name}</p>
                      <TemperatureBadge t={l.temperature} score={l.score} />
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted">{l.name}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {l.recommendedSolutions.map((sol) => (
                        <span key={sol} className="rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                          {SOL_SHORT[sol]}
                        </span>
                      ))}
                      {(l.processingStatus === "processing" || l.processingStatus === "pending") && (
                        <span className="rounded bg-analysis-soft px-1.5 py-0.5 text-[10px] font-semibold text-analysis">processando</span>
                      )}
                      {l.processingStatus === "failed" && <span className="rounded bg-attention-soft px-1.5 py-0.5 text-[10px] font-semibold text-attention">falha leitura</span>}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
                      <span className="tabular">{l.potentialValue ? `${formatBRL(l.potentialValue, { cents: false })}/ano` : "—"}</span>
                      <span>{timeAgo(l.createdAt)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
