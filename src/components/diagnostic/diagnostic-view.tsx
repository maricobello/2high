"use client";

import { ArrowRight, CheckCircle2, Loader2, MessageCircle, Printer, Sparkles, UploadCloud } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { compressImageIfNeeded } from "@/lib/client/compress-image";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import { SOLUTION_LABELS } from "@/modules/leads/types";
import type { PublicDiagnostic } from "@/modules/pipeline/public-view";
import { FindingCard } from "./finding-card";
import { HistoryChart } from "./history-chart";
import { InvoiceUploadStep } from "@/components/forms/invoice-upload-step";
import { BorderBeam } from "@/components/magicui/border-beam";

const PIPELINE = ["Recebendo a fatura", "Lendo o documento", "Extraindo e validando dados", "Executando o motor de regras", "Calculando oportunidades", "Gerando seu Raio-X"];

export function DiagnosticView({ token, initial, whatsappEnabled }: { token: string; initial: PublicDiagnostic; whatsappEnabled: boolean }) {
  const [data, setData] = useState(initial);
  const awaitingInvoice = !data.diagnostic && data.processingStatus === "no_invoice" && !data.hasInvoice;
  const processing =
    data.processingStatus === "pending" || data.processingStatus === "processing" || (!data.diagnostic && !awaitingInvoice && data.processingStatus !== "failed");

  useEffect(() => {
    if (!processing) return;
    let cancelled = false;
    let delay = 2000;
    const tick = async () => {
      try {
        const res = await fetch(`/api/diagnostics/${token}`, { cache: "no-store" });
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        /* tenta de novo */
      }
      if (!cancelled) {
        delay = Math.min(delay * 1.15, 5000);
        timer = setTimeout(tick, delay);
      }
    };
    let timer = setTimeout(tick, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [processing, token]);

  if (awaitingInvoice)
    return <AwaitingInvoice token={token} name={data.name} protocol={data.protocol} onUploaded={() => setData({ ...data, processingStatus: "pending", hasInvoice: true })} />;
  if (processing || !data.diagnostic) return <Processing name={data.name} protocol={data.protocol} />;

  const d = data.diagnostic;
  const a = d.audit;
  const m = a.metrics;
  const whatsappHref = `/api/leads/${token}/whatsapp`;

  return (
    <div className="animate-rise">
      {/* Cabeçalho */}
      <section className="relative overflow-hidden bg-ink pb-24 pt-10 text-white">
        <div className="glow absolute inset-0 opacity-70" />
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Badge tone="dark" className="border border-white/10">
              Protocolo <span className="font-mono normal-case tracking-normal">{data.protocol}</span>
            </Badge>
            <button onClick={() => window.print()} className="inline-flex items-center gap-1.5 text-xs text-white/60 hover:text-white print:hidden">
              <Printer className="size-3.5" /> Salvar PDF
            </button>
          </div>
          <p className="mt-6 font-mono text-xs uppercase tracking-[0.24em] text-cyan">Raio-X da sua energia</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            {data.company ? `${data.company}` : `Olá, ${data.name}`}
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-white/60">
            {a.basedOnInvoice ? "Diagnóstico preliminar gerado a partir da fatura enviada." : "Diagnóstico preliminar gerado a partir das informações fornecidas."}{" "}
            Todos os resultados estão sujeitos à validação técnica.
          </p>
        </div>
      </section>

      <div className="relative mx-auto -mt-16 max-w-6xl space-y-8 px-4 pb-20 sm:px-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Kpi label="Valor da fatura" value={formatBRL(m.totalAmount, { cents: m.totalAmountSource === "fatura" })} hint={m.totalAmountSource === "faixa_informada" ? "faixa informada" : m.totalAmountSource === "informado" ? "informado" : undefined} />
          <Kpi label="Consumo" value={formatNumber(m.consumptionKwh, "kWh")} hint={m.consumptionSource === "estimado" ? "estimado" : undefined} />
          <Kpi label="Perfil" value={m.profile ? `Grupo ${m.profile}` : "A confirmar"} hint={m.profile === "A" ? "média/alta tensão" : m.profile === "B" ? "baixa tensão" : undefined} />
          <Kpi label="Oportunidades" value={String(a.counts.opportunity)} tone="opportunity" />
          <Kpi label="Pontos de atenção" value={String(a.counts.attention)} tone="attention" />
          <Kpi label="Soluções potenciais" value={a.solutions.filter((s) => s !== "auditoria").length ? a.solutions.filter((s) => s !== "auditoria").map((s) => (s === "gd_assinatura" ? "GD" : "Mercado Livre")).join(" · ") : a.solutions.length ? "Revisão técnica" : "—"} small />
        </div>

        {/* HOT */}
        {data.hot && (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-opportunity/30 bg-gradient-to-r from-opportunity-soft to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-opportunity" />
              <p className="font-semibold leading-snug">Seu diagnóstico preliminar identificou oportunidades que merecem uma análise comercial.</p>
            </div>
            {whatsappEnabled && (
              <a href={whatsappHref} className={cn(buttonVariants({ variant: "whatsapp", size: "lg" }), "w-full sm:w-auto")}>
                <MessageCircle className="size-4" /> FALAR COM ESPECIALISTA NO WHATSAPP
              </a>
            )}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            {/* Resumo */}
            <section className="rounded-2xl border border-border bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Resumo executivo</p>
              <p className="mt-3 leading-relaxed text-foreground/85">{d.summary}</p>
            </section>

            {/* Achados */}
            <section className="space-y-4">
              <h2 className="text-lg font-semibold tracking-tight">O que encontramos</h2>
              {a.findings.length === 0 ? (
                <p className="rounded-2xl border border-border bg-white p-6 text-sm text-muted">
                  Não identificamos pontos de atenção com os dados disponíveis. Uma análise com histórico completo pode revelar outras oportunidades.
                </p>
              ) : (
                a.findings.map((f) => <FindingCard key={f.code} finding={f} plainText={d.findingTexts[f.code]} />)
              )}
            </section>

            {d.history.length >= 3 && (
              <section className="rounded-2xl border border-border bg-white p-6">
                <h2 className="mb-5 font-semibold">Histórico de consumo</h2>
                <HistoryChart data={d.history} current={m.consumptionKwh} />
              </section>
            )}
          </div>

          {/* Coluna lateral */}
          <aside className="space-y-5 lg:sticky lg:top-20 lg:self-start">
            <GdCard token={token} audit={a} />
            <FreeMarketCard token={token} audit={a} />
            {!data.hasInvoice && <LateUpload token={token} onUploaded={() => setData({ ...data, processingStatus: "pending", diagnostic: null })} />}
            {whatsappEnabled && !data.hot && (
              <a href={whatsappHref} className={cn(buttonVariants({ variant: "whatsapp", size: "lg" }), "w-full")}>
                <MessageCircle className="size-4" /> FALAR COM ESPECIALISTA
              </a>
            )}
            {typeof d.completeness === "number" && (
              <p className="text-center text-xs text-muted">Completude dos dados lidos na fatura: {Math.round(d.completeness * 100)}%</p>
            )}
          </aside>
        </div>

        <p className="rounded-2xl bg-subtle px-5 py-4 text-xs leading-relaxed text-muted">
          Análise preliminar gerada por motor de regras técnico (versão {a.engineVersion}) com apoio de IA para leitura e explicação. As estimativas não constituem
          promessa de economia e dependem de validação técnica, regulatória e comercial.
        </p>
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, tone, small }: { label: string; value: string; hint?: string; tone?: "attention" | "opportunity"; small?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-4 shadow-[0_10px_30px_-15px_rgba(6,10,19,0.25)]">
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-semibold tracking-tight tabular",
          small ? "text-sm leading-snug" : "text-xl",
          tone === "attention" && "text-attention",
          tone === "opportunity" && "text-opportunity",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

function useIntent(token: string, signal: "requested_gd_proposal" | "requested_ml_analysis") {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const send = async () => {
    setState("busy");
    try {
      await fetch(`/api/leads/${token}/intent`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ signal }) });
      setState("done");
    } catch {
      setState("idle");
    }
  };
  return { state, send };
}

type Audit = NonNullable<PublicDiagnostic["diagnostic"]>["audit"];

function GdCard({ token, audit }: { token: string; audit: Audit }) {
  const gd = audit.gd;
  const { state, send } = useIntent(token, "requested_gd_proposal");
  if (gd.fit === "dados_insuficientes") return null;
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">{SOLUTION_LABELS.gd_assinatura}</p>
      <p className="mt-2 font-semibold">{gd.fitLabel}</p>
      {gd.savingsMin !== null && gd.savingsMax !== null && gd.fit !== "baixo_potencial" && (
        <div className="mt-3 rounded-xl bg-subtle p-4">
          <p className="text-xs text-muted">Potencial estimado de economia</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular">
            {formatBRL(gd.savingsMin, { cents: false })}–{formatBRL(gd.savingsMax, { cents: false })}
            <span className="text-sm font-medium text-muted">/mês</span>
          </p>
        </div>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">{gd.disclaimer}</p>
      {gd.fit !== "baixo_potencial" &&
        (state === "done" ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-opportunity">
            <CheckCircle2 className="size-4" /> Recebemos! Um especialista vai preparar sua proposta.
          </p>
        ) : (
          <Button className="mt-4 w-full" onClick={send} disabled={state === "busy"}>
            QUERO RECEBER UMA PROPOSTA
          </Button>
        ))}
    </section>
  );
}

function FreeMarketCard({ token, audit }: { token: string; audit: Audit }) {
  const fm = audit.freeMarket;
  const { state, send } = useIntent(token, "requested_ml_analysis");
  return (
    <section className="rounded-2xl border border-border bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Mercado Livre — análise preliminar</p>
      <p className="mt-2 font-semibold">{fm.statusLabel}</p>
      <p className="mt-2 text-sm leading-relaxed text-foreground/75">{fm.profileSummary}</p>
      {fm.savingsMin !== null && fm.savingsMax !== null && (
        <div className="mt-3 rounded-xl bg-subtle p-4">
          <p className="text-xs text-muted">Potencial estimado</p>
          <p className="mt-1 text-xl font-semibold tabular">
            {formatBRL(fm.savingsMin, { cents: false })}–{formatBRL(fm.savingsMax, { cents: false })}
            <span className="text-sm font-medium text-muted">/mês</span>
          </p>
        </div>
      )}
      {fm.pointsToValidate.length > 0 && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-xs font-semibold text-primary">Pontos que precisam ser validados</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
            {fm.pointsToValidate.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </details>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">{fm.disclaimer}</p>
      {fm.needsCommercialAnalysis &&
        (state === "done" ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-medium text-opportunity">
            <CheckCircle2 className="size-4" /> Pedido registrado. Retornaremos em breve.
          </p>
        ) : (
          <Button variant="secondary" className="mt-4 w-full" onClick={send} disabled={state === "busy"}>
            QUERO UMA ANÁLISE COMERCIAL
          </Button>
        ))}
    </section>
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
      setErr((await res.json()).error ?? "Não foi possível enviar.");
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft/50 p-5">
      <p className="font-semibold">Quer uma análise completa?</p>
      <p className="mt-1 text-sm text-muted">Envie a fatura para auditarmos demanda, reativos, tarifas e histórico.</p>
      <input ref={ref} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => upload(e.target.files?.[0])} />
      <Button className="mt-4 w-full" onClick={() => ref.current?.click()} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <UploadCloud className="size-4" />} ENVIAR FATURA
      </Button>
      {err && <p className="mt-2 text-xs font-medium text-attention">{err}</p>}
    </section>
  );
}

function Processing({ name, protocol }: { name: string; protocol: string }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => Math.min(x + 1, PIPELINE.length - 1)), 1800);
    return () => clearInterval(t);
  }, []);
  return (
    <section className="relative flex min-h-[70vh] items-center overflow-hidden bg-ink py-16 text-white">
      <div className="glow absolute inset-0" />
      <div className="grid-bg absolute inset-0" />
      <div className="relative mx-auto w-full max-w-lg px-4">
        <div className="rounded-3xl border border-white/10 bg-ink-2/80 p-7 backdrop-blur">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan">Protocolo {protocol}</p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight">Recebemos sua solicitação, {name}.</h1>
          <p className="mt-2 text-sm text-white/60">Estamos analisando sua conta. Isso costuma levar menos de um minuto — você pode manter esta página aberta.</p>
          <div className="relative mt-7 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <div className="animate-scan pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-transparent via-cyan/15 to-transparent" />
            <ol className="space-y-3.5">
              {PIPELINE.map((s, idx) => (
                <li key={s} className={cn("flex items-center gap-3 text-sm transition-opacity", idx > i ? "opacity-35" : "opacity-100")}>
                  {idx < i ? (
                    <CheckCircle2 className="size-4 text-cyan" />
                  ) : idx === i ? (
                    <Loader2 className="size-4 animate-spin text-cyan" />
                  ) : (
                    <span className="size-4 rounded-full border border-white/25" />
                  )}
                  {s}
                </li>
              ))}
            </ol>
          </div>
          <p className="mt-5 flex items-center gap-1.5 text-xs text-white/45">
            <ArrowRight className="size-3" /> Você também receberá o link do diagnóstico por e-mail/WhatsApp.
          </p>
        </div>
      </div>
    </section>
  );
}

function AwaitingInvoice({ token, name, protocol, onUploaded }: { token: string; name: string; protocol: string; onUploaded: () => void }) {
  return (
    <section className="relative overflow-hidden bg-ink py-12 text-white sm:py-16">
      <div className="glow absolute inset-0" />
      <div className="grid-bg absolute inset-0" />
      <div className="relative mx-auto grid max-w-5xl gap-10 px-4 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan">Protocolo {protocol}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{name}, sua análise gratuita está reservada.</h1>
          <p className="mt-4 text-white/65">Falta só a fatura. Em cerca de um minuto você recebe o Raio-X com:</p>
          <ul className="mt-5 space-y-2.5 text-sm text-white/80">
            {["Pontos de atenção na cobrança (demanda, reativos, tarifas)", "Oportunidades de economia com faixa estimada", "Se GD por assinatura ou Mercado Livre fazem sentido", "Próximos passos com um especialista, se você quiser"].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-white p-5 text-foreground shadow-2xl sm:p-7">
          <BorderBeam size={120} duration={9} />
          <p className="mb-4 text-lg font-semibold">Envie a conta de energia</p>
          <InvoiceUploadStep token={token} onUploaded={onUploaded} />
        </div>
      </div>
    </section>
  );
}
