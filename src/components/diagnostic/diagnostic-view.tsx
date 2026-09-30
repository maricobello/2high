"use client";

import { ArrowRight, CheckCircle2, Loader2, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicDiagnostic } from "@/modules/pipeline/public-view";
import { Report } from "./report";
import { InvoiceUploadStep } from "@/components/forms/invoice-upload-step";
import { BorderBeam } from "@/components/magicui/border-beam";

const PIPELINE = ["Recebendo a fatura", "Lendo o documento", "Conferindo os dados", "Aplicando as regras da ANEEL", "Calculando oportunidades", "Montando o seu relatório"];

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
  if (!processing && !data.diagnostic && data.processingStatus === "failed")
    return <Failed token={token} name={data.name} protocol={data.protocol} whatsappEnabled={whatsappEnabled} onUploaded={() => setData({ ...data, processingStatus: "pending", hasInvoice: true })} />;
  if (processing || !data.diagnostic) return <Processing name={data.name} protocol={data.protocol} />;

  return <Report token={token} data={data} whatsappEnabled={whatsappEnabled} onLateUpload={() => setData({ ...data, processingStatus: "pending", diagnostic: null })} />;
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
            <ArrowRight className="size-3" /> Você também receberá o link do relatório por e-mail/WhatsApp.
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
          <p className="mt-4 text-white/65">Falta só a fatura. Em cerca de um minuto você recebe o relatório com:</p>
          <ul className="mt-5 space-y-2.5 text-sm text-white/80">
            {["Pontos de atenção na cobrança (demanda, reativos, tarifas)", "Oportunidades de economia com faixa estimada", "Se GD por assinatura ou Mercado Livre fazem sentido", "Próximos passos com um especialista, se você quiser"].map((t) => (
              <li key={t} className="flex gap-2">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-cyan" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-card p-5 text-foreground shadow-2xl sm:p-7">
          <BorderBeam size={120} duration={9} />
          <p className="mb-4 text-lg font-semibold">Envie a conta de energia</p>
          <InvoiceUploadStep token={token} onUploaded={onUploaded} />
        </div>
      </div>
    </section>
  );
}

function Failed({ token, name, protocol, whatsappEnabled, onUploaded }: { token: string; name: string; protocol: string; whatsappEnabled: boolean; onUploaded: () => void }) {
  return (
    <section className="relative overflow-hidden bg-ink py-12 text-white sm:py-16">
      <div className="glow absolute inset-0" />
      <div className="relative mx-auto grid max-w-5xl gap-10 px-4 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan">Protocolo {protocol}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">{name}, não conseguimos ler esta fatura automaticamente.</h1>
          <p className="mt-4 text-white/75">
            Isso acontece com fotos escuras, cortadas ou PDFs protegidos. Nosso time já foi avisado e pode analisar manualmente — ou você pode tentar enviar outro arquivo
            (de preferência o PDF baixado no site ou app da distribuidora).
          </p>
          {whatsappEnabled && (
            <a href={`/api/leads/${token}/whatsapp`} className={cn(buttonVariants({ variant: "whatsapp", size: "lg" }), "mt-6")}>
              <MessageCircle className="size-4" /> Falar com um especialista
            </a>
          )}
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-card p-5 text-foreground shadow-2xl sm:p-7">
          <p className="mb-4 text-lg font-semibold">Enviar outro arquivo</p>
          <InvoiceUploadStep token={token} onUploaded={onUploaded} />
        </div>
      </div>
    </section>
  );
}
