"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { readUtm } from "@/lib/client/compress-image";
import { formatCnpj, formatPhone } from "@/modules/leads/format";
import { UFS } from "@/modules/leads/types";

/** Captura de contato após simulação (GD / Mercado Livre) → cria lead e abre o Raio-X. */
export function ContactCapture({
  kind,
  simulation,
  cta,
  defaults,
}: {
  kind: "gd" | "free_market";
  simulation: Record<string, unknown>;
  cta: string;
  defaults?: { state?: string | null; city?: string | null };
}) {
  const router = useRouter();
  const [v, setV] = useState({
    name: "",
    company: "",
    cnpj: "",
    phone: "",
    email: "",
    state: defaults?.state ?? "",
    city: defaults?.city ?? "",
    consent: false,
    website: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const set = (k: keyof typeof v, val: string | boolean) => {
    setV((p) => ({ ...p, [k]: val }));
    setErrors((e) => ({ ...e, [k]: "" }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (v.name.trim().length < 2) errs.name = "Informe seu nome";
    if (v.company.trim().length < 2) errs.company = "Informe a empresa";
    if (v.phone.replace(/\D/g, "").length < 10) errs.phone = "WhatsApp com DDD";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) errs.email = "E-mail inválido";
    if (!v.state) errs.state = "Selecione";
    if (v.city.trim().length < 2) errs.city = "Informe a cidade";
    if (!v.consent) errs.consent = "Necessário para darmos retorno";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    setFormError(null);
    try {
      const res = await fetch("/api/simulations/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, kind, simulation, utm: readUtm() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.fields) setErrors(data.fields);
        setFormError(data.error ?? "Não foi possível enviar.");
        setBusy(false);
        return;
      }
      router.push(`/diagnostico/${data.token}?novo=1`);
    } catch {
      setFormError("Falha de conexão. Tente novamente.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-3.5">
      <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={v.website} onChange={(e) => set("website", e.target.value)} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome" error={errors.name}>
          <Input autoComplete="name" value={v.name} onChange={(e) => set("name", e.target.value)} invalid={!!errors.name} />
        </Field>
        <Field label="Empresa" error={errors.company}>
          <Input autoComplete="organization" value={v.company} onChange={(e) => set("company", e.target.value)} invalid={!!errors.company} />
        </Field>
        <Field label="CNPJ (opcional)" error={errors.cnpj}>
          <Input inputMode="numeric" value={v.cnpj} onChange={(e) => set("cnpj", formatCnpj(e.target.value))} invalid={!!errors.cnpj} />
        </Field>
        <Field label="WhatsApp" error={errors.phone}>
          <Input inputMode="tel" value={v.phone} onChange={(e) => set("phone", formatPhone(e.target.value))} invalid={!!errors.phone} />
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
            <Input value={v.city} onChange={(e) => set("city", e.target.value)} invalid={!!errors.city} />
          </Field>
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted">
        <input type="checkbox" className="mt-0.5 size-4 accent-primary" checked={v.consent} onChange={(e) => set("consent", e.target.checked)} />
        <span>
          Autorizo o uso dos meus dados para receber a análise e o contato comercial, conforme a{" "}
          <Link href="/privacidade" target="_blank" className="font-medium text-primary hover:underline">
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      {errors.consent && <p className="-mt-2 text-xs font-medium text-attention">{errors.consent}</p>}
      {formError && <p className="rounded-xl bg-attention-soft px-3 py-2 text-sm font-medium text-attention">{formError}</p>}
      <Button type="submit" size="lg" className="w-full" disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : null} {cta} {!busy && <ArrowRight className="size-4" />}
      </Button>
    </form>
  );
}
