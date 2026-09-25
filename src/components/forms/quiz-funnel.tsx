"use client";

import { ArrowLeft, ArrowRight, CheckCircle2, Info, Loader2, Lock, ShieldCheck } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Field, Input } from "@/components/ui/field";
import { successFeeText } from "@/lib/brand";
import { readUtm } from "@/lib/client/compress-image";
import { OPEN_ANALYSIS_EVENT } from "@/lib/client/open-analysis";
import { cn, formatBRL } from "@/lib/utils";
import { formatPhone } from "@/modules/leads/format";
import { diagnose, QUESTIONS, quizSummary, type QuizAnswers } from "@/modules/quiz/diagnosis";

/** Etapa da fatura só é baixada quando necessária (pré-carregada no resultado). */
const loadUploadStep = () => import("./invoice-upload-step");
const InvoiceUploadStep = dynamic(() => loadUploadStep().then((m) => m.InvoiceUploadStep), {
  ssr: false,
  loading: () => <div className="h-40 animate-pulse rounded-2xl bg-subtle" />,
});

type Errors = Record<string, string>;

/** Valor arredondado e legível (R$ 1,5 milhão · R$ 360 mil): evita falsa precisão. */
function compactBRL(n: number) {
  if (n >= 1_000_000) return `R$ ${(n / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${n >= 2_000_000 ? "milhões" : "milhão"}`;
  if (n >= 1_000) return `R$ ${Math.round(n / 1_000).toLocaleString("pt-BR")} mil`;
  return formatBRL(n, { cents: false });
}
const FRONTS_SHOWN = 3;
const TOTAL = QUESTIONS.length;
const RESULT = TOTAL;
const UPLOAD = TOTAL + 1;

/** Nível do diagnóstico lido como potencial (positivo), não como alarme. */
const LEVEL_STYLE = {
  ALTO: "bg-primary text-white",
  MÉDIO: "bg-primary-soft text-primary",
  MODERADO: "bg-subtle text-foreground",
} as const;
const LEVEL_LABEL = { ALTO: "Potencial alto", MÉDIO: "Potencial médio", MODERADO: "Potencial moderado" } as const;

/**
 * Funil em quiz (hero): 5 perguntas de um toque → diagnóstico preliminar
 * personalizado → contato (LGPD) → envio da fatura.
 */
export function QuizFunnel() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<QuizAnswers>>({});
  const [picked, setPicked] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [v, setV] = useState({ name: "", email: "", phone: "", consent: false, marketingConsent: false, website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const complete = QUESTIONS.every((q) => answers[q.key]);
  const result = useMemo(() => (complete ? diagnose(answers as QuizAnswers) : null), [answers, complete]);

  // Retoma o envio da fatura se a pessoa recarregar a página
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("lead_token");
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setToken(saved);
        setStep(UPLOAD);
        setFirstName(sessionStorage.getItem("lead_first_name") ?? "");
      }
    } catch {}
  }, []);

  // CTAs da página (links para #analisar) trazem o visitante de volta ao quiz
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const open = () => {
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      setHighlight(true);
      clearTimeout(timer);
      timer = setTimeout(() => setHighlight(false), 1600);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]");
      if (!(a instanceof HTMLAnchorElement)) return;
      const url = new URL(a.href, window.location.href);
      if (url.hash !== "#analisar" || url.pathname !== window.location.pathname) return;
      e.preventDefault();
      open();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener(OPEN_ANALYSIS_EVENT, open);
    const initial = window.location.hash === "#analisar" ? setTimeout(open, 350) : undefined;
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener(OPEN_ANALYSIS_EVENT, open);
      clearTimeout(timer);
      clearTimeout(initial);
    };
  }, []);

  function choose(key: string, value: string) {
    setPicked(value);
    setAnswers((p) => ({ ...p, [key]: value }));
    // pequeno atraso: o toque "acende" antes de avançar (feedback de seleção)
    setTimeout(() => {
      setPicked(null);
      setStep((s) => s + 1);
    }, 220);
  }

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
    if (!v.consent) errs.consent = "Precisamos da sua autorização para enviar o diagnóstico";
    setErrors(errs);
    if (Object.keys(errs).length) {
      // leva o foco ao primeiro campo com erro
      requestAnimationFrame(() => cardRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/leads/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, billRange: answers.bill, quiz: quizSummary(answers), utm: readUtm() }),
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
      setStep(UPLOAD);
      cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
    setBusy(false);
  }

  // pré-carrega a etapa da fatura enquanto a pessoa lê o resultado
  useEffect(() => {
    if (step === RESULT) void loadUploadStep();
  }, [step]);

  const q = step < TOTAL ? QUESTIONS[step] : null;
  const progress = step >= RESULT ? 100 : (step / TOTAL) * 100;
  const titleId = `quiz-q-${step}`;

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative scroll-mt-20 overflow-hidden rounded-[28px] border border-white/10 bg-white p-5 text-foreground shadow-[0_40px_100px_-30px_rgba(0,0,0,0.8)] ring-1 ring-black/5 transition-shadow duration-500 sm:p-7",
        highlight && "ring-4 ring-volt shadow-[0_0_0_10px_rgba(255,200,61,0.25),0_40px_100px_-30px_rgba(0,0,0,0.8)]",
      )}
    >
      {/* Barra de progresso (efeito de progresso dotado: já começa andando) */}
      <div className="flex items-center gap-3">
        {step > 0 && step <= RESULT && (
          <button type="button" onClick={() => setStep((s) => s - 1)} aria-label="Voltar" className="-my-1.5 -ml-1.5 flex size-11 items-center justify-center rounded-full text-foreground hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-subtle" role="progressbar" aria-label="Progresso do diagnóstico" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}>
          <motion.div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan" initial={false} animate={{ width: `${Math.max(6, progress)}%` }} transition={{ duration: 0.4, ease: "easeOut" }} />
        </div>
        <span aria-live="polite" className="text-xs font-bold tabular text-muted">{step < TOTAL ? `${step + 1}/${TOTAL}` : step === RESULT ? "Pronto" : "Último passo"}</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {/* ---------------- PERGUNTAS ---------------- */}
        {q && (
          <motion.div key={q.key} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="mt-5">
            {step === 0 && <p className="text-[13px] font-semibold text-primary">Empresas e condomínios · sem custo</p>}
            <h2 id={titleId} tabIndex={-1} ref={(el) => { if (el && step > 0) el.focus({ preventScroll: true }); }} className="mt-1.5 text-xl font-bold leading-snug tracking-tight outline-none sm:text-[22px]">{q.title}</h2>
            {"hint" in q && q.hint && <p className="mt-1 text-[13px] text-muted">{q.hint}</p>}
            <div
              className="mt-4 grid gap-2"
              role="radiogroup"
              aria-labelledby={titleId}
              onKeyDown={(e) => {
                if (!["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
                const items = Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]"));
                const i = items.indexOf(document.activeElement as HTMLButtonElement);
                const next = e.key === "ArrowDown" || e.key === "ArrowRight" ? i + 1 : i - 1;
                items[(next + items.length) % items.length]?.focus();
                e.preventDefault();
              }}
            >
              {q.options.map((o) => {
                const active = picked === o.value || (!picked && answers[q.key] === o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => choose(q.key, o.value)}
                    className={cn(
                      "group flex min-h-12 items-center justify-between gap-3 rounded-xl border-2 px-4 py-2.5 text-left text-[15px] font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      active ? "border-primary bg-primary-soft text-primary" : "border-border bg-white hover:-translate-y-px hover:border-primary/50 hover:shadow-sm",
                    )}
                  >
                    {o.label}
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full border-2", active ? "border-primary bg-primary text-white" : "border-border")}>
                      {active && <CheckCircle2 className="size-3" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
            {step === 0 && (
              <p className="mt-4 flex items-center justify-center gap-1.5 text-[12px] font-medium text-muted">
                <Lock className="size-3" /> Resultado na tela, antes de qualquer cadastro.
              </p>
            )}
          </motion.div>
        )}

        {/* ---------------- RESULTADO + CONTATO ---------------- */}
        {step === RESULT && result && (
          <motion.div key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="mt-5">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold text-primary">Seu diagnóstico preliminar</p>
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", LEVEL_STYLE[result.level])}>
                {LEVEL_LABEL[result.level]}
              </span>
            </div>

            <h2 tabIndex={-1} ref={(el) => el?.focus({ preventScroll: true })} className="mt-2 text-lg font-bold leading-snug tracking-tight outline-none">Pontos que merecem auditoria na sua conta</h2>

            <div className="mt-3 rounded-2xl bg-ink p-4 text-white">
              <p className="text-[28px] font-bold leading-tight tracking-tight text-volt">
                {result.fronts.length} {result.fronts.length === 1 ? "ponto" : "pontos"} a verificar
              </p>
              <p className="mt-1 text-[13px] leading-snug text-white/80">
                Volume que vamos revisar: <strong className="font-semibold text-white">{compactBRL(result.auditableVolume)}</strong> em {result.months} faturas (estimativa).
              </p>
              {result.icmsEmbedded !== null && (
                <p className="mt-1.5 text-[12.5px] leading-snug text-white/85">
                  Desse total, cerca de <strong className="text-white">{compactBRL(result.icmsEmbedded)}</strong> são ICMS. Parte pode virar crédito.
                </p>
              )}
            </div>

            <p className="mt-4 text-sm font-bold">O que verificar no seu caso</p>
            <ul className="mt-2 space-y-1.5">
              {result.fronts.slice(0, FRONTS_SHOWN).map((f) => (
                <li key={f.code} className="flex gap-2 text-[13.5px] leading-snug">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-opportunity" />
                  <span>
                    <strong className="font-semibold">{f.title}.</strong> <span className="text-muted">{f.detail}</span>
                  </span>
                </li>
              ))}
              {result.fronts.length > FRONTS_SHOWN && (
                <li className="pl-6 text-[13px] font-medium text-muted">+ {result.fronts.length - FRONTS_SHOWN} no relatório completo</li>
              )}
            </ul>

            <p className="mt-4 rounded-xl bg-subtle px-3 py-2.5 text-[13px] font-medium leading-snug text-foreground/80">
              Auditoria sem custo. {successFeeText()}.
            </p>

            <form onSubmit={submitContact} noValidate className="mt-5 space-y-3 border-t border-border pt-5">
              <p className="text-base font-bold">Para onde enviamos o relatório?</p>
              <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={v.website} onChange={(e) => set("website", e.target.value)} name="website" />
              <Field label="Seu nome" error={errors.name}>
                <Input autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} placeholder="Como podemos te chamar?" />
              </Field>
              <Field label="E-mail" error={errors.email}>
                <Input type="email" autoComplete="email" inputMode="email" value={v.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} placeholder="voce@email.com.br" />
              </Field>
              <Field label="WhatsApp" error={errors.phone}>
                <Input inputMode="tel" autoComplete="tel" value={v.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} invalid={!!errors.phone} placeholder="(11) 99999-9999" />
              </Field>
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-[13.5px] leading-snug text-muted">
                <input type="checkbox" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} aria-invalid={errors.consent ? true : undefined} aria-describedby={errors.consent ? "consent-error" : undefined} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
                <span>
                  Autorizo o uso dos meus dados para receber o diagnóstico e ser contatado sobre o resultado por e-mail e WhatsApp, conforme a{" "}
                  <Link href="/privacidade" target="_blank" className="font-semibold text-primary hover:underline">
                    Política de Privacidade
                  </Link>
                  . Posso revogar quando quiser.
                </span>
              </label>
              {errors.consent && <p id="consent-error" role="alert" className="text-xs font-medium text-attention">{errors.consent}</p>}
              <label className="flex min-h-11 cursor-pointer items-start gap-3 py-1 text-[13.5px] leading-snug text-muted">
                <input type="checkbox" checked={v.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-[var(--primary)]" />
                <span>Quero receber conteúdos sobre redução de custos de energia (opcional).</span>
              </label>
              {formError && <p className="rounded-lg bg-attention-soft px-3 py-2 text-sm text-attention">{formError}</p>}
              <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60">
                {busy ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Enviando…
                  </>
                ) : (
                  <>
                    Reservar meu diagnóstico <ArrowRight className="size-4" />
                  </>
                )}
              </button>
              <p className="flex gap-1 text-[12px] leading-snug text-muted">
                <Info className="mt-px size-3 shrink-0" /> No próximo passo, envie a fatura agora ou depois. Estimativa baseada nas suas respostas; não é promessa de valor.
              </p>
            </form>
          </motion.div>
        )}

        {/* ---------------- ENVIO DA FATURA ---------------- */}
        {step === UPLOAD && token && (
          <motion.div key="upload" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }} className="mt-5">
            <h2 className="text-xl font-bold leading-snug tracking-tight">{firstName ? `${firstName}, falta` : "Falta"} só a fatura.</h2>
            <p className="mt-1 text-sm text-muted">Envie a mais recente. A análise leva cerca de 1 minuto.</p>
            <p className="mb-4 mt-3 flex items-start gap-2 rounded-xl bg-opportunity-soft px-3 py-2.5 text-[13px] font-medium text-opportunity">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Diagnóstico reservado. Também enviamos o link por e-mail.
            </p>
            <InvoiceUploadStep token={token} compact initialBillRange={answers.bill ?? null} />
            <div className="mt-4 border-t border-border pt-4">
              <p className="text-center text-[13px] text-muted">A fatura está com o financeiro ou a administradora? Encaminhe o link.</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`Pode enviar a fatura de energia neste link para o diagnóstico? ${typeof window !== "undefined" ? window.location.origin : ""}/diagnostico/${token}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-[13.5px] font-semibold text-foreground hover:bg-subtle"
                >
                  Encaminhar no WhatsApp
                </a>
                <Link href={`/diagnostico/${token}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border px-3 text-[13.5px] font-semibold text-foreground hover:bg-subtle">
                  Enviar depois
                </Link>
              </div>
            </div>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-muted">
              <ShieldCheck className="size-3" /> Envio criptografado. Uso restrito ao diagnóstico, conforme a LGPD.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
