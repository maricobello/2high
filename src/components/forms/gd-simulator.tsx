"use client";

import { Calculator, Info, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils";
import { distributorOptionsForState } from "@/modules/invoice/distributors";
import { UFS } from "@/modules/leads/types";
import type { GdResult } from "@/modules/simulators/gd";
import { ContactCapture } from "./contact-capture";

const CLASSES = ["Comercial", "Industrial", "Rural", "Poder Público", "Residencial"];

export function GdSimulator() {
  const [v, setV] = useState({
    monthlyBill: "",
    consumptionKwh: "",
    state: "",
    city: "",
    distributor: "",
    customerClass: "Comercial",
    consumerUnit: "",
    tariffGroup: "",
  });
  const [result, setResult] = useState<GdResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const distributors = useMemo(() => distributorOptionsForState(v.state || null), [v.state]);
  const set = (k: keyof typeof v, val: string) => setV((p) => ({ ...p, [k]: val }));

  const payload = () => ({
    monthlyBill: v.monthlyBill ? Number(v.monthlyBill.replace(/\./g, "").replace(",", ".")) : null,
    consumptionKwh: v.consumptionKwh ? Number(v.consumptionKwh.replace(/\./g, "").replace(",", ".")) : null,
    state: v.state || null,
    city: v.city || null,
    distributor: v.distributor || null,
    customerClass: v.customerClass || null,
    consumerUnit: v.consumerUnit || null,
    tariffGroup: v.tariffGroup === "A" || v.tariffGroup === "B" ? v.tariffGroup : null,
  });

  async function simulate(e: React.FormEvent) {
    e.preventDefault();
    if (!v.monthlyBill && !v.consumptionKwh) {
      setError("Informe o valor médio da conta ou o consumo médio.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulations/gd", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Não foi possível simular.");
      else setResult(data.result);
    } catch {
      setError("Falha de conexão.");
    }
    setBusy(false);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={simulate} className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        <p className="flex items-center gap-2 font-semibold">
          <Calculator className="size-4 text-primary" /> Simule sua economia
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label="Valor médio da conta (R$)">
            <Input inputMode="decimal" placeholder="Ex.: 3.500" value={v.monthlyBill} onChange={(e) => set("monthlyBill", e.target.value)} />
          </Field>
          <Field label="Consumo médio (kWh/mês)">
            <Input inputMode="numeric" placeholder="Opcional" value={v.consumptionKwh} onChange={(e) => set("consumptionKwh", e.target.value)} />
          </Field>
          <div className="grid grid-cols-[88px_1fr] gap-3 sm:col-span-2">
            <Field label="Estado">
              <Select value={v.state} onChange={(e) => set("state", e.target.value)}>
                <option value="">UF</option>
                {UFS.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </Select>
            </Field>
            <Field label="Cidade">
              <Input value={v.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
          </div>
          <Field label="Distribuidora" className="sm:col-span-2">
            <Select value={v.distributor} onChange={(e) => set("distributor", e.target.value)}>
              <option value="">Selecione ou deixe em branco</option>
              {distributors.map((d) => (
                <option key={d.code} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Classe">
            <Select value={v.customerClass} onChange={(e) => set("customerClass", e.target.value)}>
              {CLASSES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
          <Field label="Tensão">
            <Select value={v.tariffGroup} onChange={(e) => set("tariffGroup", e.target.value)}>
              <option value="">Não sei</option>
              <option value="B">Baixa tensão (Grupo B)</option>
              <option value="A">Média/alta tensão (Grupo A)</option>
            </Select>
          </Field>
          <Field label="Unidade consumidora (opcional)" className="sm:col-span-2">
            <Input value={v.consumerUnit} onChange={(e) => set("consumerUnit", e.target.value)} placeholder="Nº da instalação na fatura" />
          </Field>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-attention">{error}</p>}
        <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} SIMULAR ECONOMIA
        </Button>
      </form>

      <div className="rounded-3xl border border-border bg-card p-5 sm:p-7">
        {!result ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center text-muted">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <Calculator className="size-6" />
            </div>
            <p className="max-w-xs text-sm">Preencha os dados ao lado para ver uma estimativa preliminar em faixa.</p>
          </div>
        ) : (
          <div className="animate-rise space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Resultado preliminar</p>
              <p className="mt-2 text-lg font-semibold">{result.fitLabel}</p>
            </div>
            {result.savingsMin !== null && result.savingsMax !== null && result.fit !== "dados_insuficientes" && (
              <div className="rounded-2xl bg-ink p-5 text-white">
                <p className="text-xs text-white/60">Potencial estimado de economia</p>
                <p className="mt-1 text-3xl font-semibold tracking-tight tabular">
                  {formatBRL(result.savingsMin, { cents: false })}–{formatBRL(result.savingsMax, { cents: false })}
                  <span className="text-base font-medium text-white/60">/mês</span>
                </p>
                <p className="mt-1 text-xs text-white/50 tabular">
                  {formatBRL(result.annualMin, { cents: false })}–{formatBRL(result.annualMax, { cents: false })} por ano
                </p>
              </div>
            )}
            <ul className="space-y-1.5 text-sm text-foreground/80">
              {result.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
            <details className="text-sm">
              <summary className="cursor-pointer text-xs font-semibold text-primary">Premissas do cálculo</summary>
              <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
                {result.assumptions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </details>
            <p className="flex gap-1.5 rounded-xl bg-subtle p-3 text-[11px] leading-relaxed text-muted">
              <Info className="mt-px size-3 shrink-0" /> {result.disclaimer}
            </p>
            {result.fit !== "dados_insuficientes" && (
              <div className="border-t border-border pt-5">
                <p className="mb-3 font-semibold">Receba uma proposta sem compromisso</p>
                <ContactCapture kind="gd" simulation={payload()} cta="QUERO RECEBER UMA PROPOSTA" defaults={{ state: v.state, city: v.city }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
