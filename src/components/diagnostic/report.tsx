"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileDown,
  FileText,
  Gauge,
  Info,
  Loader2,
  MessageCircle,
  Settings2,
  Share2,
  TrendingUp,
  UploadCloud,
  User,
  Zap,
} from "lucide-react";
import { useRef, useState } from "react";
import { LogoMark } from "@/components/site/logo";
import { compressImageIfNeeded } from "@/lib/client/compress-image";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import type { PublicDiagnostic } from "@/modules/pipeline/public-view";
import type { Finding } from "@/modules/rules-engine/types";
import { HistoryChart } from "./history-chart";

type Diagnostic = NonNullable<PublicDiagnostic["diagnostic"]>;
type Signal = "requested_gd_proposal" | "requested_ml_analysis" | "requested_full_diagnostic";

const TZ = "America/Sao_Paulo";
const fmtDateTime = (iso: string) => {
  const d = new Date(iso);
  return `${d.toLocaleDateString("pt-BR", { timeZone: TZ })} às ${d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}`;
};
const isoDateBr = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const monthBr = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]}/${ym.slice(0, 4)}`;

const KIND = {
  opportunity: { label: "Oportunidade", bar: "bg-opportunity", chip: "border-opportunity/40 bg-opportunity-soft text-opportunity" },
  attention: { label: "Ponto de atenção", bar: "bg-attention", chip: "border-attention/40 bg-attention-soft text-attention" },
  analysis: { label: "Análise técnica", bar: "bg-analysis", chip: "border-analysis/40 bg-analysis-soft text-analysis" },
  info: { label: "Informação", bar: "bg-primary", chip: "border-primary/40 bg-primary-soft text-primary-text" },
} as const;
const CONFIDENCE = { alta: { w: "90%", label: "Alta" }, média: { w: "62%", label: "Média" }, baixa: { w: "34%", label: "Baixa" } } as const;

/** "R$ 2.339 a R$ 5.263" ou, se a faixa começa em zero, "até R$ 3.150". */
const rangeText = (r: { min: number; max: number }) =>
  r.min > 0 ? `${formatBRL(r.min, { cents: false })} a ${formatBRL(r.max, { cents: false })}` : `até ${formatBRL(r.max, { cents: false })}`;

/** Maior faixa estimada entre as oportunidades (alternativas não se somam). */
function bestRange(d: Diagnostic) {
  const ranges: { min: number; max: number }[] = [];
  for (const f of d.audit.findings) if (f.kind === "opportunity" && f.estimatedMonthlyImpact) ranges.push(f.estimatedMonthlyImpact);
  const { gd, freeMarket: fm } = d.audit;
  if (gd.savingsMin !== null && gd.savingsMax !== null && gd.fit !== "baixo_potencial" && gd.fit !== "dados_insuficientes") ranges.push({ min: gd.savingsMin, max: gd.savingsMax });
  if (fm.savingsMin !== null && fm.savingsMax !== null) ranges.push({ min: fm.savingsMin, max: fm.savingsMax });
  if (!ranges.length) return null;
  return { min: Math.max(...ranges.map((r) => r.min)), max: Math.max(...ranges.map((r) => r.max)) };
}

function useIntent(token: string, signal: Signal) {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const send = async () => {
    setState("busy");
    try {
      const res = await fetch(`/api/leads/${token}/intent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signal }) });
      setState(res.ok ? "done" : "idle");
    } catch {
      setState("idle");
    }
  };
  return { state, send };
}

export function Report({
  token,
  data,
  whatsappEnabled,
  onLateUpload,
}: {
  token: string;
  data: PublicDiagnostic;
  whatsappEnabled: boolean;
  onLateUpload: () => void;
}) {
  const d = data.diagnostic!;
  const a = d.audit;
  const m = a.metrics;
  const range = bestRange(d);
  const generatedAt = fmtDateTime(d.createdAt);
  const period =
    d.invoice?.periodStart && d.invoice?.periodEnd
      ? `${isoDateBr(d.invoice.periodStart)} a ${isoDateBr(d.invoice.periodEnd)}`
      : m.referenceMonth
        ? monthBr(m.referenceMonth)
        : "Não informado";

  const info = [
    { icon: User, label: "Cliente", value: data.company ?? `Olá, ${data.name}` },
    { icon: Building2, label: "Perfil", value: m.profile ? `Grupo ${m.profile}` : "A confirmar" },
    { icon: Zap, label: "Distribuidora", value: m.distributor ?? "Não informada" },
    { icon: Gauge, label: "Unidade consumidora", value: d.invoice?.consumerUnit ?? "Não informada" },
    { icon: CalendarDays, label: "Período analisado", value: period },
    { icon: FileText, label: "Documento", value: a.basedOnInvoice ? "Conta de energia (fatura)" : "Dados informados" },
  ];

  return (
    <div className="bg-background pb-16 print:pb-0">
      <div className="mx-auto max-w-[1600px] space-y-5 px-4 pt-6 sm:px-6 lg:px-8 lg:pt-8 2xl:px-10">
        {/* ---------- cabeçalho do relatório ---------- */}
        <header className="flex flex-col gap-5 rounded-3xl border border-border bg-card p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Análise preliminar de energia</h1>
              <span className="rounded-full border border-opportunity/40 bg-opportunity-soft px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-opportunity">Preliminar</span>
            </div>
            <p className="mt-1.5 text-sm text-muted">Relatório da sua conta de energia, item por item.</p>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between xl:shrink-0">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted">Protocolo</dt>
              <dd className="font-mono font-semibold">#{data.protocol}</dd>
              <dt className="text-muted">Gerado em</dt>
              <dd className="tabular">{generatedAt}</dd>
            </dl>
            <ReportActions protocol={data.protocol} />
          </div>
        </header>

        {/* ---------- faixa de dados ---------- */}
        <section aria-label="Dados da análise" className="rounded-3xl border border-border bg-card p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 min-[1700px]:grid-cols-[repeat(6,minmax(0,1fr))_auto] min-[1700px]:items-center">
            {info.map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex min-w-0 items-start gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary-text" aria-hidden />
                <div className="min-w-0">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-sm font-semibold break-words">{value}</p>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-3 rounded-2xl border border-opportunity/35 bg-opportunity-soft px-4 py-3 min-[420px]:col-span-2 md:col-span-3 min-[1700px]:col-span-1">
              <CheckCircle2 className="size-5 shrink-0 text-opportunity" aria-hidden />
              <div>
                <p className="text-sm font-semibold text-opportunity">Dados processados</p>
                <p className="text-xs text-muted">Análise concluída</p>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- corpo ----------
            Ordem no celular/tablet: resumo → indicadores e próximos passos → achados → histórico.
            No computador a lateral ocupa a 2ª coluna em todas as linhas. */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
            {/* resumo + potencial */}
            <section className="grid min-w-0 gap-5 rounded-3xl border border-border bg-card p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:items-center xl:col-start-1">
              <div>
                <h2 className="flex items-center gap-2.5 text-lg font-semibold">
                  <ClipboardList className="size-5 text-primary-text" aria-hidden /> Resumo
                </h2>
                <p className="mt-3 leading-relaxed text-foreground/85">{d.summary}</p>
              </div>
              {range ? (
                <div className="rounded-2xl border border-opportunity/40 bg-opportunity-soft p-5">
                  <p className="flex items-center gap-2 text-sm font-semibold text-opportunity">
                    <TrendingUp className="size-4" aria-hidden /> Maior potencial estimado
                  </p>
                  <p className="mt-2 text-2xl font-bold tracking-tight tabular text-opportunity sm:text-3xl">
                    {rangeText(range)}
                    <span className="text-base font-semibold">/mês</span>
                  </p>
                  <p className="mt-1 text-xs text-muted">Estimativa preliminar, sujeita à validação técnica.</p>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-subtle p-5">
                  <p className="text-sm font-semibold">Pontos para revisar</p>
                  <p className="mt-2 text-3xl font-bold tabular">{a.findings.length}</p>
                  <p className="mt-1 text-xs text-muted">O valor depende da análise técnica completa.</p>
                </div>
              )}
            </section>

            {/* lateral (2ª coluna no computador) */}
            <aside className="grid min-w-0 content-start gap-5 md:grid-cols-2 xl:sticky xl:top-24 xl:col-start-2 xl:row-span-3 xl:row-start-1 xl:grid-cols-1 xl:self-start print:grid-cols-1">
              <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                <h2 className="flex items-center gap-2.5 text-lg font-semibold">
                  <BarChart3 className="size-5 text-primary-text" aria-hidden /> Indicadores
                </h2>
                <dl className="mt-3 divide-y divide-border text-sm">
                  <Indicator label="Valor da fatura" value={formatBRL(m.totalAmount, { cents: m.totalAmountSource === "fatura" })} hint={m.totalAmountSource === "faixa_informada" ? "faixa informada" : undefined} />
                  <Indicator label="Consumo" value={formatNumber(m.consumptionKwh, "kWh")} hint={m.consumptionSource === "estimado" ? "estimado" : undefined} />
                  {m.avgPricePerKwh !== null && <Indicator label="Preço médio" value={`${formatBRL(m.avgPricePerKwh)}/kWh`} />}
                  <Indicator label="Oportunidades" value={String(a.counts.opportunity)} tone="opportunity" />
                  <Indicator label="Pontos de atenção" value={String(a.counts.attention)} tone={a.counts.attention ? "attention" : undefined} />
                  <Indicator label="Perfil" value={m.profile ? `Grupo ${m.profile}` : "A confirmar"} />
                </dl>
              </section>

              <NextSteps token={token} diagnostic={d} whatsappEnabled={whatsappEnabled} />
              {!data.hasInvoice && <LateUpload token={token} onUploaded={onLateUpload} />}
            </aside>

            {/* achados */}
            <section className="min-w-0 rounded-3xl border border-border bg-card p-5 sm:p-6 xl:col-start-1">
              <h2 className="flex items-center gap-2.5 text-lg font-semibold">
                <FileText className="size-5 text-primary-text" aria-hidden /> Principais achados
              </h2>
              {a.findings.length === 0 ? (
                <p className="mt-4 text-sm text-muted">Não encontramos pontos de atenção com os dados disponíveis. Uma análise com o histórico completo pode revelar outras oportunidades.</p>
              ) : (
                <ol className="mt-2">
                  {a.findings.map((f, i) => (
                    <FindingRow key={f.code} index={i + 1} finding={f} text={d.findingTexts[f.code]} />
                  ))}
                </ol>
              )}
            </section>

            {/* histórico + metodologia */}
            <div className={cn("grid min-w-0 gap-5 xl:col-start-1", d.history.length >= 3 && "lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]")}>
              {d.history.length >= 3 && <HistorySection history={d.history} />}
              <section className="rounded-3xl border border-border bg-card p-5 sm:p-6">
                <h2 className="flex items-center gap-2.5 text-lg font-semibold">
                  <Settings2 className="size-5 text-primary-text" aria-hidden /> Dados e metodologia
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-muted">
                  Análise preliminar feita com os dados da sua conta de energia, as regras tarifárias da ANEEL e o seu perfil de consumo. Os valores são estimativas e não substituem a análise técnica detalhada.
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {["Dados da fatura", "Tarifas e regras da ANEEL", "Perfil de consumo e demanda", "Recomendações preliminares"].map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <CheckCircle2 className="size-4 shrink-0 text-opportunity" aria-hidden /> {t}
                    </li>
                  ))}
                </ul>
                {typeof d.completeness === "number" && <p className="mt-4 text-xs text-muted">Dados lidos da fatura: {Math.round(d.completeness * 100)}%</p>}
              </section>
            </div>
        </div>

        {/* ---------- rodapé do relatório ---------- */}
        <footer className="grid gap-5 rounded-3xl border border-border bg-card p-5 text-sm sm:p-6 md:grid-cols-[auto_1fr_auto] md:items-center">
          <div className="flex items-center gap-3">
            <LogoMark className="h-9 w-auto" />
            <div>
              <p className="font-semibold">Análise preliminar emitida pela Aferi</p>
              <p className="text-xs text-muted">Auditoria e gestão de energia</p>
            </div>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 md:justify-self-center">
            <dt className="text-muted">Protocolo</dt>
            <dd className="font-mono">#{data.protocol}</dd>
            <dt className="text-muted">Gerado em</dt>
            <dd className="tabular">{generatedAt}</dd>
          </dl>
          <p className="flex items-start gap-2 text-xs text-muted md:max-w-60">
            <Info className="mt-px size-4 shrink-0" aria-hidden /> Documento informativo. Não substitui a validação técnica.
          </p>
        </footer>
      </div>
    </div>
  );
}

function ReportActions({ protocol }: { protocol: string }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: `Análise preliminar de energia · ${protocol}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* compartilhamento cancelado */
    }
  };
  return (
    <div className="grid grid-cols-2 gap-2 sm:flex print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card sm:gap-2 sm:px-4 sm:text-sm"
      >
        <FileDown className="size-4" aria-hidden /> Exportar PDF
      </button>
      <button
        type="button"
        onClick={share}
        className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-border px-3 text-[13px] font-semibold transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:gap-2 sm:px-4 sm:text-sm"
      >
        <Share2 className="size-4" aria-hidden /> <span aria-live="polite">{copied ? "Link copiado" : "Compartilhar"}</span>
      </button>
    </div>
  );
}

function FindingRow({ index, finding: f, text }: { index: number; finding: Finding; text?: string }) {
  const k = KIND[f.kind];
  const c = CONFIDENCE[f.confidence];
  return (
    <li className="relative grid gap-4 border-t border-border py-5 pl-5 first:border-t-0 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)_minmax(0,0.75fr)_minmax(0,0.9fr)] lg:gap-6">
      <span aria-hidden className={cn("absolute bottom-5 left-0 top-5 w-1 rounded-full", k.bar)} />
      <div className="min-w-0">
        <div className="flex gap-3">
          <span className="font-mono text-xl leading-6 font-bold text-muted tabular">{String(index).padStart(2, "0")}</span>
          <div className="min-w-0">
            <h3 className="text-base leading-6 font-semibold">{f.title}</h3>
            <span className={cn("mt-1.5 inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.12em]", k.chip)}>{k.label}</span>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-foreground/80">{text || f.explanation}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3 lg:contents">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <Activity className="size-3.5" aria-hidden /> Dados utilizados
          </p>
          {f.dataUsed.length ? (
            <ul className="mt-2 space-y-1 text-xs">
              {f.dataUsed.slice(0, 4).map((u) => (
                <li key={u.label} className="flex flex-wrap gap-x-1.5">
                  <span className="text-muted">{u.label}:</span>
                  <span className="font-medium tabular">{u.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-muted">Perfil e dados informados</p>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">Confiança da análise</p>
          <div className="mt-2.5 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle" role="meter" aria-label="Confiança da análise" aria-valuetext={c.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={parseInt(c.w)}>
              <div className="h-full rounded-full bg-primary" style={{ width: c.w }} />
            </div>
            <span className="text-xs font-semibold">{c.label}</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
            <TrendingUp className="size-3.5" aria-hidden /> Impacto estimado
          </p>
          {f.estimatedMonthlyImpact ? (
            <p className="mt-1.5 text-base font-bold tabular text-opportunity">
              {rangeText(f.estimatedMonthlyImpact)}
              <span className="text-xs font-semibold">/mês</span>
              <span className="block text-[11px] font-normal text-muted">estimativa</span>
            </p>
          ) : (
            <p className="mt-1.5 text-sm font-medium text-muted">A validar na análise técnica</p>
          )}
        </div>
      </div>
    </li>
  );
}

function Indicator({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "opportunity" | "attention" }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-muted">
        {label}
        {hint && <span className="ml-1 text-[11px]">({hint})</span>}
      </dt>
      <dd className={cn("font-semibold tabular", tone === "opportunity" && "text-opportunity", tone === "attention" && "text-attention")}>{value}</dd>
    </div>
  );
}

function HistorySection({ history }: { history: { month: string; kwh: number }[] }) {
  const total = history.reduce((acc, h) => acc + h.kwh, 0);
  const peak = history.reduce((best, h) => (h.kwh > best.kwh ? h : best), history[0]);
  return (
    <section className="grid gap-5 rounded-3xl border border-border bg-card p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2.5 text-lg font-semibold">
          <TrendingUp className="size-5 text-primary-text" aria-hidden /> Histórico de consumo
        </h2>
        <div className="mt-4">
          <HistoryChart data={history} />
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-4 text-sm md:grid-cols-1 md:content-center md:border-l md:border-border md:pl-5">
        <div>
          <dt className="text-xs text-muted">Consumo no período</dt>
          <dd className="mt-0.5 font-semibold tabular">{formatNumber(total, "kWh")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Média mensal</dt>
          <dd className="mt-0.5 font-semibold tabular">{formatNumber(Math.round(total / history.length), "kWh")}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Maior consumo</dt>
          <dd className="mt-0.5 font-semibold tabular">{monthBr(peak.month)}</dd>
        </div>
      </dl>
    </section>
  );
}

function NextSteps({ token, diagnostic: d, whatsappEnabled }: { token: string; diagnostic: Diagnostic; whatsappEnabled: boolean }) {
  const full = useIntent(token, "requested_full_diagnostic");
  const gd = useIntent(token, "requested_gd_proposal");
  const ml = useIntent(token, "requested_ml_analysis");
  const gdFit = d.audit.gd.fit !== "baixo_potencial" && d.audit.gd.fit !== "dados_insuficientes";
  const mlFit = d.audit.freeMarket.needsCommercialAnalysis;
  return (
    <section className="rounded-3xl border border-border bg-card p-5 sm:p-6 print:hidden">
      <h2 className="flex items-center gap-2.5 text-lg font-semibold">
        <Zap className="size-5 text-volt" aria-hidden /> Próximos passos
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Para confirmar os valores, recomendamos o <strong className="font-semibold text-foreground">diagnóstico completo</strong>, com a análise técnica das faturas do período.
      </p>
      {full.state === "done" ? (
        <p role="status" className="mt-4 flex items-center gap-2 rounded-xl bg-opportunity-soft px-4 py-3 text-sm font-medium text-opportunity">
          <CheckCircle2 className="size-4 shrink-0" /> Pedido recebido. Um especialista vai falar com você.
        </p>
      ) : (
        <button
          type="button"
          onClick={full.send}
          disabled={full.state === "busy"}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:opacity-60"
        >
          {full.state === "busy" ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />} Solicitar diagnóstico completo
        </button>
      )}
      {whatsappEnabled && (
        <a
          href={`/api/leads/${token}/whatsapp`}
          className="mt-2.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border text-sm font-semibold transition-colors hover:border-primary/50"
        >
          <MessageCircle className="size-4" aria-hidden /> Falar com um especialista
        </a>
      )}
      {(gdFit || mlFit) && (
        <div className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
          <p className="text-xs font-medium text-muted">Também pode interessar</p>
          {gdFit && <IntentLink state={gd.state} onClick={gd.send} label="Proposta de energia por assinatura" done="Proposta solicitada" />}
          {mlFit && <IntentLink state={ml.state} onClick={ml.send} label="Análise do Mercado Livre" done="Análise solicitada" />}
        </div>
      )}
    </section>
  );
}

function IntentLink({ state, onClick, label, done }: { state: "idle" | "busy" | "done"; onClick: () => void; label: string; done: string }) {
  if (state === "done")
    return (
      <p className="flex items-center gap-2 font-medium text-opportunity">
        <CheckCircle2 className="size-4" /> {done}
      </p>
    );
  return (
    <button type="button" onClick={onClick} disabled={state === "busy"} className="flex w-full items-center justify-between gap-2 rounded-lg py-1.5 text-left font-medium text-primary-text hover:underline disabled:opacity-60">
      {label} <ArrowRight className="size-4 shrink-0" aria-hidden />
    </button>
  );
}

function LateUpload({ token, onUploaded }: { token: string; onUploaded: () => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const upload = async (f?: File | null) => {
    if (!f) return;
    setBusy(true);
    setErr(null);
    const file = await compressImageIfNeeded(f);
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/leads/${token}/invoice`, { method: "POST", body: fd });
    if (res.ok) onUploaded();
    else {
      setErr((await res.json().catch(() => ({}))).error ?? "Não foi possível enviar.");
      setBusy(false);
    }
  };
  return (
    <section className="rounded-3xl border border-dashed border-primary/40 bg-primary-soft/50 p-5 md:col-span-2 xl:col-span-1 print:hidden">
      <p className="font-semibold">Quer a análise completa?</p>
      <p className="mt-1 text-sm text-muted">Envie a fatura para revisarmos demanda, reativos, tarifas e histórico.</p>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        disabled={busy}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} Enviar fatura
      </button>
      {err && (
        <p role="alert" className="mt-2 text-xs font-medium text-attention">
          {err}
        </p>
      )}
    </section>
  );
}
