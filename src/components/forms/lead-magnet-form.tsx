"use client";

import { ArrowRight, CheckCircle2, Clock, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { BorderBeam } from "@/components/magicui/border-beam";
import { ShimmerButton } from "@/components/magicui/shimmer-button";
import { Field, Input } from "@/components/ui/field";
import { readUtm } from "@/lib/client/compress-image";
import { formatPhone } from "@/modules/leads/schema";
import { InvoiceUploadStep } from "./invoice-upload-step";

type Errors = Record<string, string>;

/**
 * Isca de conversão em 2 etapas:
 *  1) nome, e-mail e WhatsApp (+ consentimento LGPD) → lead criado na hora
 *  2) envio da fatura → Raio-X automático
 * Quem para na etapa 1 recebe o link por e-mail/WhatsApp e lembretes automáticos.
 */
export function LeadMagnetForm() {
  const [token, setToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [v, setV] = useState({ name: "", email: "", phone: "", consent: false, marketingConsent: false, website: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Retoma a etapa 2 se a pessoa recarregar a página
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("lead_token");
      const name = sessionStorage.getItem("lead_first_name");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setToken(saved);
      if (name) setFirstName(name);
    } catch {}
  }, []);

  const set = (k: keyof typeof v, val: string | boolean) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
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
        body: JSON.stringify({ ...v, utm: readUtm() }),
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
    } catch {
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
    }
    setBusy(false);
  }

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white p-5 text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.65)] sm:p-7">
      <BorderBeam size={120} duration={9} />
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Análise gratuita da fatura</p>
          <p className="mt-1 text-lg font-semibold leading-snug tracking-tight">
            {token ? `Perfeito${firstName ? `, ${firstName}` : ""}! Agora envie a fatura` : "Receba o Raio-X da energia da sua empresa"}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold tabular text-muted">{token ? "2/2" : "1/2"}</span>
      </div>

      {/* Barra de progresso */}
      <div className="mb-5 h-1.5 overflow-hidden rounded-full bg-subtle">
        <div className="h-full rounded-full bg-gradient-to-r from-primary to-cyan transition-all duration-700" style={{ width: token ? "100%" : "50%" }} />
      </div>

      {token ? (
        <>
          <p className="mb-4 flex items-start gap-2 rounded-xl bg-opportunity-soft px-3 py-2.5 text-[13px] text-opportunity">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" /> Análise reservada! Também enviamos o link e um guia bônus para o seu e-mail.
          </p>
          <InvoiceUploadStep token={token} compact />
          <p className="mt-3 text-center text-xs text-muted">
            Não está com a fatura agora?{" "}
            <Link href={`/diagnostico/${token}`} className="font-semibold text-primary hover:underline">
              Enviar depois pelo link
            </Link>
          </p>
        </>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-3.5">
          <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={v.website} onChange={(e) => set("website", e.target.value)} name="website" />
          <Field label="Seu nome" error={errors.name}>
            <Input autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} placeholder="Como podemos te chamar?" />
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
              <Link href="/privacidade" target="_blank" className="font-medium text-primary hover:underline">
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

          <ShimmerButton type="submit" disabled={busy} className="w-full text-[15px]">
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                QUERO MINHA ANÁLISE GRATUITA <ArrowRight className="size-4" />
              </>
            )}
          </ShimmerButton>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Clock className="size-3" /> Resultado em ~1 minuto
            </span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="size-3" /> Dados protegidos (LGPD)
            </span>
            <span>Sem compromisso</span>
          </div>
        </form>
      )}
    </div>
  );
}
