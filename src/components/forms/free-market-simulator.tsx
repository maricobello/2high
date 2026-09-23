"use client";

import { BarChart3, CheckCircle2, Info, Loader2, TriangleAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { formatBRL } from "@/lib/utils";
import { distributorOptionsForState } from "@/modules/invoice/distributors";
import { UFS } from "@/modules/leads/types";
import type { FreeMarketResult } from "@/modules/simulators/free-market";
import { ContactCapture } from "./contact-capture";

const toNum = (s: string) => (s ? Number(s.replace(/\./g, "").replace(",", ".")) : null);

export function FreeMarketSimulator() {
  const [v, setV] = useState({
    state: "",
    city: "",
    distributor: "",
    monthlyConsumptionKwh: "",
    monthlyBill: "",
    demandKw: "",
    tariffGroup: "",
    tariffModality: "",
    voltage: "",
    operatingHours: "",
    consumptionProfile: "",
  });
  const [result, setResult] = useState<FreeMarketResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const distributors = useMemo(() => distributorOptionsForState(v.state || null), [v.state]);
  const set = (k: keyof typeof v, val: string) => setV((p) => ({ ...p, [k]: val }));

  const payload = () => ({
    state: v.state || null,
    city: v.city || null,
    distributor: v.distributor || null,
    monthlyConsumptionKwh: toNum(v.monthlyConsumptionKwh),
    monthlyBill: toNum(v.monthlyBill),
    demandKw: toNum(v.demandKw),
    tariffGroup: v.tariffGroup === "A" || v.tariffGroup === "B" ? v.tariffGroup : null,
    tariffModality: v.tariffModality || null,
    voltage: v.voltage || null,
    operatingHours: (v.operatingHours || null) as "comercial" | "estendido" | "24h" | null,
    consumptionProfile: (v.consumptionProfile || null) as "estavel" | "sazonal" | "variavel" | null,
  });

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/simulations/free-market", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload()) });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "Não foi possível analisar.");
      else setResult(data.result);
    } catch {
      setError("Falha de conexão.");
    }
    setBusy(false);
  }

  const tone = result?.status === "perfil_compativel" ? "opportunity" : result?.status === "fora_do_perfil_atual" ? "neutral" : "analysis";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <form onSubmit={analyze} className="rounded-3xl border border-border bg-white p-5 sm:p-7">
        <p className="flex items-center gap-2 font-semibold">
          <BarChart3 className="size-4 text-primary" /> Dados da unidade
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
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
              <option value="">Selecione</option>
              {distributors.map((d) => (
                <option key={d.code} value={d.name}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Consumo mensal (kWh)">
            <Input inputMode="numeric" value={v.monthlyConsumptionKwh} onChange={(e) => set("monthlyConsumptionKwh", e.target.value)} placeholder="Ex.: 40.000" />
          </Field>
          <Field label="Valor médio da conta (R$)">
            <Input inputMode="decimal" value={v.monthlyBill} onChange={(e) => set("monthlyBill", e.target.value)} placeholder="Opcional" />
          </Field>
          <Field label="Demanda contratada (kW)">
            <Input inputMode="numeric" value={v.demandKw} onChange={(e) => set("demandKw", e.target.value)} placeholder="Ex.: 300" />
          </Field>
          <Field label="Grupo tarifário">
            <Select value={v.tariffGroup} onChange={(e) => set("tariffGroup", e.target.value)}>
              <option value="">Não sei</option>
              <option value="A">Grupo A (média/alta tensão)</option>
              <option value="B">Grupo B (baixa tensão)</option>
            </Select>
          </Field>
          <Field label="Modalidade">
            <Select value={v.tariffModality} onChange={(e) => set("tariffModality", e.target.value)}>
              <option value="">Não sei</option>
              <option value="Verde">Horária Verde</option>
              <option value="Azul">Horária Azul</option>
              <option value="Convencional">Convencional</option>
            </Select>
          </Field>
          <Field label="Tensão de fornecimento">
            <Select value={v.voltage} onChange={(e) => set("voltage", e.target.value)}>
              <option value="">Não sei</option>
              <option value="13,8 kV">13,8 kV</option>
              <option value="23 kV">23 kV</option>
              <option value="34,5 kV">34,5 kV</option>
              <option value="69 kV ou mais">69 kV ou mais</option>
              <option value="Baixa tensão">Baixa tensão (127/220/380 V)</option>
            </Select>
          </Field>
          <Field label="Horário de funcionamento">
            <Select value={v.operatingHours} onChange={(e) => set("operatingHours", e.target.value)}>
              <option value="">Selecione</option>
              <option value="comercial">Horário comercial</option>
              <option value="estendido">Horário estendido</option>
              <option value="24h">24 horas</option>
            </Select>
          </Field>
          <Field label="Perfil de consumo">
            <Select value={v.consumptionProfile} onChange={(e) => set("consumptionProfile", e.target.value)}>
              <option value="">Selecione</option>
              <option value="estavel">Estável ao longo do ano</option>
              <option value="sazonal">Sazonal</option>
              <option value="variavel">Variável</option>
            </Select>
          </Field>
        </div>
        {error && <p className="mt-3 text-sm font-medium text-attention">{error}</p>}
        <Button type="submit" size="lg" className="mt-5 w-full" disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null} GERAR ANÁLISE PRELIMINAR
        </Button>
      </form>

      <div className="rounded-3xl border border-border bg-white p-5 sm:p-7">
        {!result ? (
          <div className="flex h-full flex-col items-center justify-center py-10 text-center text-muted">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary-soft text-primary">
              <BarChart3 className="size-6" />
            </div>
            <p className="max-w-xs text-sm">Informe os dados da unidade para receber uma análise preliminar de perfil.</p>
          </div>
        ) : (
          <div className="animate-rise space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Análise preliminar</p>
              <Badge tone={tone} className="mt-2">
                {result.statusLabel}
              </Badge>
              <p className="mt-3 text-sm leading-relaxed text-foreground/80">{result.profileSummary}</p>
            </div>
            {result.identified.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Informações identificadas</p>
                <dl className="grid gap-2 rounded-2xl bg-subtle/70 p-4 text-sm">
                  {result.identified.map((i) => (
                    <div key={i.label + i.value} className="flex justify-between gap-3">
                      <dt className="text-muted">{i.label}</dt>
                      <dd className="text-right font-medium">{i.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
            <div className="rounded-2xl bg-ink p-5 text-white">
              <p className="text-xs text-white/60">Potencial de economia</p>
              {result.savingsMin !== null && result.savingsMax !== null ? (
                <p className="mt-1 text-2xl font-semibold tabular">
                  {formatBRL(result.savingsMin, { cents: false })}–{formatBRL(result.savingsMax, { cents: false })}
                  <span className="text-sm text-white/60">/mês</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-white/80">Não calculável com os dados informados.</p>
              )}
              <p className="mt-2 text-[11px] text-white/50">{result.savingsNote}</p>
            </div>
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                <TriangleAlert className="size-3.5" /> Pontos que precisam ser validados
              </p>
              <ul className="space-y-1.5 text-sm text-foreground/80">
                {result.pointsToValidate.map((p) => (
                  <li key={p} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-muted" /> {p}
                  </li>
                ))}
              </ul>
            </div>
            <p className="flex gap-1.5 rounded-xl bg-subtle p-3 text-[11px] leading-relaxed text-muted">
              <Info className="mt-px size-3 shrink-0" /> {result.disclaimer}
            </p>
            {result.needsCommercialAnalysis && (
              <div className="border-t border-border pt-5">
                <p className="mb-3 font-semibold">Necessita análise comercial</p>
                <ContactCapture kind="free_market" simulation={payload()} cta="QUERO UMA ANÁLISE COMERCIAL" defaults={{ state: v.state, city: v.city }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
