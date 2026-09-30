import { AlertTriangle, Bot, CheckCircle2, Clock, FileText, Hash } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { db, type AiUsageRecord } from "@/modules/db";

export const dynamic = "force-dynamic";

const PERIODS = [7, 30, 90] as const;

const TASK_LABELS: Record<string, string> = {
  leitura_fatura_texto: "Leitura da fatura (texto)",
  leitura_fatura_imagem: "Leitura da fatura (imagem)",
  explicacao_relatorio: "Texto do relatório",
  assistente_chat: "Assistente do site",
  classificar_mensagem: "Classificar mensagem",
  mensagem_follow_up: "Mensagem de follow-up",
  outros: "Outros",
};
const REPORT_TASKS = new Set(["leitura_fatura_texto", "leitura_fatura_imagem", "explicacao_relatorio"]);

const nf = new Intl.NumberFormat("pt-BR");
const fmtMs = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s` : `${Math.round(ms)} ms`);
const fmtDate = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

interface Group {
  key: string;
  calls: number;
  ok: number;
  tokens: number;
  latency: number;
  last: string;
}
function groupBy(rows: AiUsageRecord[], key: (r: AiUsageRecord) => string): Group[] {
  const map = new Map<string, Group>();
  for (const r of rows) {
    const k = key(r);
    const g = map.get(k) ?? { key: k, calls: 0, ok: 0, tokens: 0, latency: 0, last: r.createdAt };
    g.calls++;
    if (r.ok) g.ok++;
    g.tokens += r.totalTokens ?? 0;
    g.latency += r.latencyMs;
    if (r.createdAt > g.last) g.last = r.createdAt;
    map.set(k, g);
  }
  return [...map.values()].sort((a, b) => b.calls - a.calls);
}
function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

/** Janela do período e dias da série (fora do componente: usa o relógio). */
function periodWindow(days: number) {
  const now = Date.now();
  return {
    since: new Date(now - days * 86400_000).toISOString(),
    dayStarts: Array.from({ length: days }, (_, i) => new Date(now - (days - 1 - i) * 86400_000).toISOString()),
  };
}

export default async function AiUsagePage(props: PageProps<"/admin/ia">) {
  const sp = await props.searchParams;
  const days = PERIODS.includes(Number(sp.dias) as (typeof PERIODS)[number]) ? Number(sp.dias) : 30;
  const { since, dayStarts } = periodWindow(days);

  let rows: AiUsageRecord[] = [];
  let loadError: string | null = null;
  try {
    rows = await db().listAiUsage(since, 10000);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Falha ao carregar";
  }
  const leads = rows.some((r) => r.leadId) ? await db().listLeads({ limit: 2000 }) : [];
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const calls = rows.length;
  const okCalls = rows.filter((r) => r.ok).length;
  const tokens = rows.reduce((a, r) => a + (r.totalTokens ?? 0), 0);
  const latencies = rows.map((r) => r.latencyMs);
  const reports = groupBy(
    rows.filter((r) => r.leadId && REPORT_TASKS.has(r.task)),
    (r) => r.leadId!,
  ).sort((a, b) => b.last.localeCompare(a.last));
  const byTask = groupBy(rows, (r) => r.task);
  const byModel = groupBy(rows, (r) => r.model);
  const errors = rows.filter((r) => !r.ok).slice(0, 10);

  // série diária (fuso de São Paulo)
  const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
  const series = dayStarts.map((iso) => {
    const k = dayKey(iso);
    const dayRows = rows.filter((r) => dayKey(r.createdAt) === k);
    return { k, ok: dayRows.filter((r) => r.ok).length, fail: dayRows.filter((r) => !r.ok).length };
  });
  const maxDay = Math.max(1, ...series.map((s) => s.ok + s.fail));

  const kpis = [
    { label: "Chamadas à IA", value: nf.format(calls), icon: Bot },
    { label: "Taxa de sucesso", value: calls ? `${Math.round((okCalls / calls) * 100)}%` : "—", icon: CheckCircle2, tone: calls && okCalls / calls < 0.9 ? "attention" : undefined },
    { label: "Relatórios com IA", value: nf.format(reports.length), icon: FileText },
    { label: "Tokens usados", value: nf.format(tokens), icon: Hash },
    { label: "Tempo médio / p95", value: calls ? `${fmtMs(latencies.reduce((a, b) => a + b, 0) / calls)} · ${fmtMs(percentile(latencies, 95))}` : "—", icon: Clock },
    { label: "Tokens por relatório", value: reports.length ? nf.format(Math.round(reports.reduce((a, g) => a + g.tokens, 0) / reports.length)) : "—", icon: FileText },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Uso da IA</h1>
          <p className="mt-1 text-sm text-muted">Leitura das faturas, texto dos relatórios, assistente e mensagens. Só metadados: nenhum conteúdo de fatura é guardado aqui.</p>
        </div>
        <nav aria-label="Período" className="flex rounded-xl border border-border bg-card p-1 text-sm">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/admin/ia?dias=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={cn("rounded-lg px-3 py-1.5 font-medium", p === days ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground")}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </div>

      {loadError && (
        <p role="alert" className="rounded-xl border border-attention/40 bg-attention-soft px-4 py-3 text-sm text-attention">
          Não foi possível carregar o uso da IA ({loadError}). Confira se a migração 0006_ai_usage foi aplicada.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted">{label}</p>
              <Icon className="size-4 shrink-0 text-primary-text" />
            </div>
            <p className={cn("mt-2 text-xl font-semibold tracking-tight tabular sm:text-2xl", tone === "attention" && "text-attention")}>{value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Chamadas por dia</h2>
          <p className="flex items-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-primary" /> sucesso</span>
            <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-attention" /> erro</span>
          </p>
        </div>
        <div className="mt-4 flex h-40 items-end gap-[2px]" role="img" aria-label={`Chamadas por dia nos últimos ${days} dias`}>
          {series.map((s) => (
            <div key={s.k} className="flex h-full flex-1 flex-col justify-end" title={`${s.k.split("-").reverse().join("/")}: ${s.ok} ok, ${s.fail} erro`}>
              {s.fail > 0 && <div className="w-full rounded-t-sm bg-attention" style={{ height: `${(s.fail / maxDay) * 100}%` }} />}
              <div className={cn("w-full bg-primary", s.fail ? "" : "rounded-t-sm")} style={{ height: `${(s.ok / maxDay) * 100}%`, minHeight: s.ok ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[11px] text-muted">
          <span>{series[0].k.split("-").reverse().slice(0, 2).join("/")}</span>
          <span>hoje</span>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Table
          title="Por tarefa"
          head={["Tarefa", "Chamadas", "Sucesso", "Tokens", "Tempo médio"]}
          rows={byTask.map((g) => [TASK_LABELS[g.key] ?? g.key, nf.format(g.calls), `${Math.round((g.ok / g.calls) * 100)}%`, nf.format(g.tokens), fmtMs(g.latency / g.calls)])}
          empty="Nenhuma chamada no período."
        />
        <Table
          title="Por modelo"
          head={["Modelo", "Chamadas", "Sucesso", "Tokens", "Tempo médio"]}
          rows={byModel.map((g) => [<span key="m" className="font-mono text-xs">{g.key}</span>, nf.format(g.calls), `${Math.round((g.ok / g.calls) * 100)}%`, nf.format(g.tokens), fmtMs(g.latency / g.calls)])}
          empty="Nenhuma chamada no período."
        />
      </div>

      <Table
        title="Por relatório (análise de fatura)"
        head={["Lead", "Protocolo", "Análise em", "Chamadas", "Erros", "Tokens", "Tempo total"]}
        rows={reports.slice(0, 50).map((g) => {
          const lead = leadById.get(g.key);
          return [
            <Link key="l" href={`/admin/leads/${g.key}`} className="font-medium text-primary-text hover:underline">
              {lead?.company || lead?.name || "Lead removido"}
            </Link>,
            <span key="p" className="font-mono text-xs">{lead?.protocol ?? "—"}</span>,
            fmtDate(g.last),
            nf.format(g.calls),
            g.calls - g.ok ? <span key="e" className="text-attention">{g.calls - g.ok}</span> : "0",
            nf.format(g.tokens),
            fmtMs(g.latency),
          ];
        })}
        empty="Nenhum relatório analisado com IA no período."
      />

      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="size-4 text-attention" /> Últimos erros
        </h2>
        {errors.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Nenhum erro no período.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {errors.map((e) => (
              <li key={e.id} className="flex flex-col gap-1 py-2.5 text-sm sm:flex-row sm:items-baseline sm:gap-4">
                <span className="shrink-0 text-xs text-muted tabular">{fmtDate(e.createdAt)}</span>
                <span className="shrink-0 font-medium">{TASK_LABELS[e.task] ?? e.task}</span>
                <span className="min-w-0 break-words text-muted">{e.error}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: React.ReactNode[][]; empty: string }) {
  return (
    <section className="min-w-0 rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">{empty}</p>
      ) : (
        // rolável no celular: focável para rolar pelo teclado
        <div className="mt-3 overflow-x-auto rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" tabIndex={0} role="region" aria-label={title}>
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                {head.map((h, i) => (
                  <th key={h} scope="col" className={cn("pb-2 font-medium", i > 0 && "pl-4 text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r, i) => (
                <tr key={i}>
                  {r.map((c, j) => (
                    <td key={j} className={cn("py-2.5", j > 0 && "pl-4 text-right whitespace-nowrap tabular")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
