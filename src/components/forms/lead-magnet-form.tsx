"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Clock, Info, Loader2, Lock, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { BorderBeam } from "@/components/magicui/border-beam";
import { celebrate } from "@/components/magicui/confetti";
import { NumberTicker } from "@/components/magicui/number-ticker";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Field, Input } from "@/components/ui/field";
import { readUtm } from "@/lib/client/compress-image";
import { cn, formatBRL } from "@/lib/utils";
import { formatPhone } from "@/modules/leads/schema";
import { billRangeFromAmount } from "@/modules/leads/types";
import { simulateGd } from "@/modules/simulators/gd";
import { InvoiceUploadStep } from "./invoice-upload-step";

type Errors = Record<string, string>;
type Step = 0 | 1 | 2;

/** Escala logarítmica do slider: R$ 500 → R$ 200.000 (mais precisão nas contas menores). */
const MIN = 500;
const MAX = 200_000;
const toAmount = (t: number) => {
  const raw = MIN * Math.pow(MAX / MIN, t / 1000);
  const step = raw < 5_000 ? 50 : raw < 50_000 ? 500 : 1_000;
  return Math.round(raw / step) * step;
};
const toT = (amount: number) => Math.round((Math.log(amount / MIN) / Math.log(MAX / MIN)) * 1000);

/**
 * Funil do hero (progressive disclosure):
 *  0) calculadora — micro-conversão sem dados pessoais (valor-primeiro)
 *  1) contato + consentimento LGPD → lead criado na hora
 *  2) envio da fatura → Raio-X automático
 */
export function LeadMagnetForm() {
  const [step, setStep] = useState<Step>(0);
  const [t, setT] = useState(toT(6_000));
  const [token, setToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [v, setV] = useState({ name: "", email: "", phone: "", consent: false, marketingConsent: false, website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const amount = toAmount(t);
  const billRange = billRangeFromAmount(amount);
  const gd = useMemo(() => simulateGd({ monthlyBill: amount, tariffGroup: null }), [amount]);
  const fill = `${(t / 1000) * 100}%`;

  // Retoma a etapa de envio se a pessoa recarregar a página
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("lead_token");
      const name = sessionStorage.getItem("lead_first_name");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(saved);
        setStep(2);
      }
      if (name) setFirstName(name);
    } catch {}
  }, []);

  const set = (k: keyof typeof v, val: string | boolean) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submitContact(e: React.FormEvent) {
    e.preventDefault();
    const errs: Errors = {};
    if (v.name.trim().length < 2) errs.name = "Informe seu nome";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) errs.email = "E-mail inválido";
    if (v.phone.replace(/\D/g, "").length < 10) errs.phone = "WhatsApp com DDD";
    if (!v.consent) errs.consent = "Precisamos da sua autorização para enviar a análise";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/leads/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, billRange: billRange ?? undefined, utm: readUtm() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setFormError(data.error ?? "Não foi possível enviar. Tente novamente.");
        setBusy(false);
        return;
      }
      const first = v.name.trim().split(" ")[0];
      try {
        sessionStorage.setItem("lead_token", data.token);
        sessionStorage.setItem("lead_first_name", first);
      } catch {}
      setFirstName(first);
      setToken(data.token);
      setStep(2);
      celebrate();
    } catch {
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
    setBusy(false);
  }

  const titles: Record<Step, string> = {
    0: "Quanto sua empresa paga de energia por mês?",
    1: "Para onde enviamos o seu Raio-X?",
    2: `Perfeito${firstName ? `, ${firstName}` : ""}! Agora envie a fatura`,
  };

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-white p-5 text-foreground shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)] ring-1 ring-black/5 sm:p-7">
      <BorderBeam size={140} duration={9} />

      {/* Stepper */}
      <div className="mb-5 flex items-center gap-2" aria-label={`Etapa ${step + 1} de 3`}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-subtle">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan" initial={false} animate={{ width: i <= step ? "100%" : "0%" }} transition={{ duration: 0.5, ease: "easeOut" }} />
          </div>
        ))}
        <span className="ml-1 text-xs font-bold tabular text-muted">{step + 1}/3</span>
      </div>

      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Análise gratuita da fatura</p>
      <h2 className="mt-1 text-xl font-semibold leading-snug tracking-tight">{titles[step]}</h2>

      <AnimatePresence mode="wait" initial={false}>
        {step === 0 && (
          <motion.div key="calc" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25 }} className="mt-5">
            <div className="flex items-end justify-between">
              <span className="text-sm text-muted">Conta média</span>
              <span className="text-3xl font-bold tracking-tight tabular">
                {formatBRL(amount, { cents: false })}
                {amount >= MAX && "+"}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={1000}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              aria-label="Valor médio mensal da conta de energia"
              aria-valuetext={formatBRL(amount, { cents: false })}
              className="range-energy mt-4 w-full"
              style={{ "--fill": fill } as React.CSSProperties}
            />
            <div className="mt-1.5 flex justify-between text-[11px] text-muted">
              <span>R$ 500</span>
              <span>R$ 200 mil+</span>
            </div>

            <div className="mt-5 rounded-2xl bg-ink p-4 text-white">
              <p className="flex items-center gap-1.5 text-xs font-medium text-white/75">
                <Zap className="size-3.5 text-volt" /> Potencial estimado com energia por assinatura
              </p>
              {gd.savingsMin !== null && gd.savingsMax !== null ? (
                <p className="mt-1 text-[28px] font-bold leading-tight tracking-tight text-volt">
                  <NumberTicker value={gd.savingsMin} prefix="R$ " /> – <NumberTicker value={gd.savingsMax} prefix="R$ " />
                  <span className="text-base font-semibold text-white/75">/mês</span>
                </p>
              ) : (
                <p className="mt-1 text-sm">Informe o valor para estimar.</p>
              )}
              {/* Barras comparativas: conta atual x faixa estimada */}
              <div className="mt-3 space-y-1.5" aria-hidden>
                <div className="h-2 w-full rounded-full bg-white/20" />
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-cyan"
                    animate={{ width: `${gd.savingsMax ? 100 - (gd.savingsMax / amount) * 100 : 100}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                </div>
              </div>
              <div className="mt-1.5 flex justify-between text-[10px] text-white/60">
                <span>conta atual</span>
                <span>após economia estimada</span>
              </div>
              {amount >= 8_000 && (
                <p className="mt-3 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] leading-snug text-white/85">
                  Se a unidade for de média tensão (Grupo A), o Mercado Livre também pode ser avaliado no seu Raio-X.
                </p>
              )}
            </div>
            <p className="mt-2 flex gap-1 text-[10.5px] leading-snug text-muted">
              <Info className="mt-px size-3 shrink-0" /> Estimativa preliminar, não é promessa.
            </p>

            <ShimmerButton type="button" onClick={() => setStep(1)} className="mt-5 w-full text-[15px]">
              VER MINHA ANÁLISE COMPLETA GRÁTIS <ArrowRight className="size-4" />
            </ShimmerButton>
            <TrustRow />
          </motion.div>
        )}

        {step === 1 && (
          <motion.form
            key="contact"
            onSubmit={submitContact}
            noValidate
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.25 }}
            className="mt-5 space-y-3.5"
          >
            <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={v.website} onChange={(e) => set("website", e.target.value)} name="website" />
            <Field label="Seu nome" error={errors.name}>
              <Input autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} placeholder="Como podemos te chamar?" autoFocus />
            </Field>
            <Field label="E-mail" error={errors.email}>
              <Input type="email" autoComplete="email" inputMode="email" value={v.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} placeholder="voce@empresa.com.br" />
            </Field>
            <Field label="WhatsApp" error={errors.phone}>
              <Input inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} invalid={!!errors.phone} placeholder="(11) 99999-9999" />
            </Field>

            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span>
                Autorizo o uso dos meus dados para receber a análise e ser contatado sobre o resultado por e-mail e WhatsApp, conforme a{" "}
                <Link href="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">
                  Política de Privacidade
                </Link>
                . Posso revogar quando quiser.
              </span>
            </label>
            {errors.consent && <p className="-mt-2 text-xs font-medium text-attention">{errors.consent}</p>}
            <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={v.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
              <span>Quero receber conteúdos sobre redução de custos de energia (opcional).</span>
            </label>

            {formError && <p className="rounded-xl bg-attention-soft px-3 py-2 text-sm font-medium text-attention">{formError}</p>}

            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(0)} aria-label="Voltar" className="flex h-[52px] w-12 shrink-0 items-center justify-center rounded-[14px] border border-border text-muted hover:bg-subtle">
                <ArrowLeft className="size-4" />
              </button>
              <ShimmerButton type="submit" disabled={busy} className="flex-1 text-[15px]">
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <>
                    QUERO MINHA ANÁLISE GRATUITA <ArrowRight className="size-4" />
                  </>
                )}
              </ShimmerButton>
            </div>
            <TrustRow />
          </motion.form>
        )}

        {step === 2 && token && (
          <motion.div key="upload" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="mt-4">
            <p className="mb-4 flex items-start gap-2 rounded-xl bg-opportunity-soft px-3 py-2.5 text-[13px] font-medium text-opportunity">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Análise reservada! Também enviamos o link e um guia bônus para o seu e-mail.
            </p>
            <InvoiceUploadStep token={token} compact initialBillRange={billRange} />
            <p className="mt-3 text-center text-xs text-muted">
              Não está com a fatura agora?{" "}
              <Link href={`/diagnostico/${token}`} className="font-semibold text-primary hover:underline">
                Enviar depois pelo link
              </Link>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrustRow() {
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] font-medium text-muted">
      <span className="flex items-center gap-1">
        <Clock className="size-3" /> Raio-X em até 1 min
      </span>
      <span className="flex items-center gap-1">
        <ShieldCheck className="size-3" /> LGPD
      </span>
      <span className={cn("flex items-center gap-1")}>
        <Lock className="size-3" /> Sem compromisso
      </span>
    </div>
  );
}
