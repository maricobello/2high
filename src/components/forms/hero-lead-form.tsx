"use client";

import { ArrowLeft, ArrowRight, FileText, Loader2, Lock, UploadCloud, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { compressImageIfNeeded, readUtm } from "@/lib/client/compress-image";
import { cn } from "@/lib/utils";
import { formatCnpj, formatPhone } from "@/modules/leads/schema";
import { BILL_RANGES, FREE_MARKET_STATUS, SOLAR_STATUS, UFS } from "@/modules/leads/types";

const MAX_BYTES = 4_400_000;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

type Errors = Record<string, string>;

export function HeroLeadForm() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [v, setV] = useState({
    billRange: "",
    name: "",
    company: "",
    cnpj: "",
    phone: "",
    email: "",
    state: "",
    city: "",
    solarStatus: "nao",
    freeMarketStatus: "nao_sei",
    consent: false,
    marketingConsent: false,
    website: "",
  });
  const set = (k: keyof typeof v, value: string | boolean) => {
    setV((p) => ({ ...p, [k]: value }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function pickFile(f: File | undefined | null) {
    if (!f) return;
    setErrors((e) => ({ ...e, file: "" }));
    if (!ACCEPT.split(",").includes(f.type)) {
      setErrors((e) => ({ ...e, file: "Formato não suportado. Envie PDF, JPG, PNG ou WEBP." }));
      return;
    }
    const ready = await compressImageIfNeeded(f);
    if (ready.size > MAX_BYTES) {
      setErrors((e) => ({ ...e, file: "Arquivo maior que 4 MB. Envie o PDF da fatura ou uma foto menor." }));
      return;
    }
    setFile(ready);
  }

  function nextStep() {
    const errs: Errors = {};
    if (!file) errs.file = "Anexe a fatura (PDF ou foto).";
    if (!v.billRange) errs.billRange = "Selecione a faixa.";
    setErrors(errs);
    if (Object.keys(errs).length === 0) setStep(2);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (step === 1) return nextStep();
    if (!file) return setStep(1);
    const errs: Errors = {};
    if (v.name.trim().length < 2) errs.name = "Informe seu nome";
    if (v.company.trim().length < 2) errs.company = "Informe a empresa";
    if (v.phone.replace(/\D/g, "").length < 10) errs.phone = "WhatsApp com DDD";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) errs.email = "E-mail inválido";
    if (!v.state) errs.state = "Selecione";
    if (v.city.trim().length < 2) errs.city = "Informe a cidade";
    if (!v.consent) errs.consent = "Necessário para processarmos sua fatura";
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setBusy(true);
    setFormError(null);
    try {
      const fd = new FormData();
      for (const [k, val] of Object.entries(v)) fd.append(k, String(val));
      fd.append("file", file);
      const utm = readUtm();
      if (utm) fd.append("utm", JSON.stringify(utm));
      const res = await fetch("/api/leads", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) {
          setErrors(data.fields);
          if (data.fields.billRange || data.fields.file) setStep(1);
        }
        setFormError(data.error ?? "Não foi possível enviar. Tente novamente.");
        setBusy(false);
        return;
      }
      router.push(`/diagnostico/${data.token}?novo=1`);
    } catch {
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="relative rounded-3xl border border-white/10 bg-white p-5 text-foreground shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] sm:p-7">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Análise preliminar gratuita</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">{step === 1 ? "Envie sua conta de energia" : "Para onde enviamos o diagnóstico?"}</p>
        </div>
        <span className="rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-muted tabular">{step}/2</span>
      </div>

      {/* honeypot */}
      <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={v.website} onChange={(e) => set("website", e.target.value)} name="website" />

      {step === 1 ? (
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void pickFile(e.dataTransfer.files?.[0]);
            }}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
            className={cn(
              "group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed px-4 py-7 text-center transition-all",
              dragging ? "border-primary bg-primary-soft" : errors.file ? "border-attention/60 bg-attention-soft/40" : "border-border bg-subtle/60 hover:border-primary/50 hover:bg-primary-soft/50",
            )}
          >
            <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void pickFile(e.target.files?.[0])} />
            {file ? (
              <div className="flex w-full items-center gap-3 text-left">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{file.name}</p>
                  <p className="text-xs text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB · pronto para análise</p>
                </div>
                <button
                  type="button"
                  aria-label="Remover arquivo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="rounded-lg p-2 text-muted hover:bg-white hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <>
                <span className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-primary shadow-sm transition-transform group-hover:-translate-y-0.5">
                  <UploadCloud className="size-6" />
                </span>
                <p className="text-sm font-semibold">Arraste a fatura aqui ou toque para escolher</p>
                <p className="mt-1 text-xs text-muted">PDF da distribuidora ou foto nítida · até 4 MB</p>
              </>
            )}
          </div>
          {errors.file && <p className="-mt-2 text-xs font-medium text-attention">{errors.file}</p>}

          <Field label="Valor médio mensal da conta" error={errors.billRange} group>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BILL_RANGES.map((r) => (
                <button
                  type="button"
                  key={r.value}
                  onClick={() => set("billRange", r.value)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-all",
                    v.billRange === r.value ? "border-primary bg-primary-soft text-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </Field>

          <Button type="submit" size="lg" className="w-full">
            ANALISAR MINHA FATURA <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome" error={errors.name}>
              <Input autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
            </Field>
            <Field label="Empresa" error={errors.company}>
              <Input autoComplete="organization" value={v.company} onChange={(e) => set("company", e.target.value)} invalid={!!errors.company} />
            </Field>
            <Field label="CNPJ (opcional)" error={errors.cnpj}>
              <Input inputMode="numeric" placeholder="00.000.000/0000-00" value={v.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} invalid={!!errors.cnpj} />
            </Field>
            <Field label="WhatsApp" error={errors.phone}>
              <Input inputMode="tel" autoComplete="tel" placeholder="(11) 99999-9999" value={v.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} invalid={!!errors.phone} />
            </Field>
            <Field label="E-mail" error={errors.email} className="sm:col-span-2">
              <Input type="email" autoComplete="email" value={v.email} onChange={(e) => set("email", e.target.value)} invalid={!!errors.email} />
            </Field>
            <div className="grid grid-cols-[88px_1fr] gap-3 sm:col-span-2">
              <Field label="Estado" error={errors.state}>
                <Select value={v.state} onChange={(e) => set("state", e.target.value)} invalid={!!errors.state}>
                  <option value="">UF</option>
                  {UFS.map((uf) => (
                    <option key={uf}>{uf}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Cidade" error={errors.city}>
                <Input autoComplete="address-level2" value={v.city} onChange={(e) => set("city", e.target.value)} invalid={!!errors.city} />
              </Field>
            </div>
            <Field label="Você já utiliza energia solar?">
              <Select value={v.solarStatus} onChange={(e) => set("solarStatus", e.target.value)}>
                {SOLAR_STATUS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Já está no Mercado Livre?">
              <Select value={v.freeMarketStatus} onChange={(e) => set("freeMarketStatus", e.target.value)}>
                {FREE_MARKET_STATUS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} />
            <span>
              Autorizo o tratamento dos meus dados e da fatura para gerar o diagnóstico e ser contatado sobre o resultado, conforme a{" "}
              <Link href="/privacidade" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
                Política de Privacidade
              </Link>
              .
            </span>
          </label>
          {errors.consent && <p className="-mt-2 text-xs font-medium text-attention">{errors.consent}</p>}
          <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
            <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={v.marketingConsent} onChange={(e) => set("marketingConsent", e.target.checked)} />
            <span>Quero receber conteúdos sobre energia (opcional).</span>
          </label>

          {formError && <p className="rounded-xl bg-attention-soft px-3 py-2 text-sm font-medium text-attention">{formError}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)} aria-label="Voltar" className="px-4">
              <ArrowLeft className="size-4" />
            </Button>
            <Button type="submit" size="lg" className="flex-1" disabled={busy}>
              {busy ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Enviando com segurança…
                </>
              ) : (
                <>
                  RECEBER MEU DIAGNÓSTICO <ArrowRight className="size-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <Lock className="size-3" /> Arquivo criptografado em trânsito, armazenado em ambiente privado · LGPD
      </p>
    </form>
  );
}
