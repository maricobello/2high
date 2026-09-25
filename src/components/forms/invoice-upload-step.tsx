"use client";

import { ChevronDown, FileText, Loader2, Lock, UploadCloud, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Field, Input, Select } from "@/components/ui/field";
import { compressImageIfNeeded } from "@/lib/client/compress-image";
import { cn } from "@/lib/utils";
import { BILL_RANGES, FREE_MARKET_STATUS, SOLAR_STATUS, UFS } from "@/modules/leads/types";

const MAX_BYTES = 4_400_000;
const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp";

/**
 * Etapa 2: envio da fatura (+ dados opcionais). Usada no hero e na página do
 * diagnóstico para quem deixou o contato e voltou depois pelo link.
 */
export function InvoiceUploadStep({ token, onUploaded, compact, initialBillRange }: { token: string; onUploaded?: () => void; compact?: boolean; initialBillRange?: string | null }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [billRange, setBillRange] = useState(initialBillRange ?? "");
  const [more, setMore] = useState(false);
  const [d, setD] = useState({ company: "", state: "", city: "", solarStatus: "", freeMarketStatus: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(f?: File | null) {
    if (!f) return;
    setError(null);
    if (!ACCEPT.split(",").includes(f.type)) return setError("Formato não suportado. Envie PDF, JPG, PNG ou WEBP.");
    const ready = await compressImageIfNeeded(f);
    if (ready.size > MAX_BYTES) return setError("Arquivo maior que 4 MB. Envie o PDF da fatura ou uma foto menor.");
    setFile(ready);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return setError("Anexe a fatura (PDF ou foto nítida).");
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (billRange) fd.append("billRange", billRange);
      for (const [k, v] of Object.entries(d)) if (v) fd.append(k, v);
      const res = await fetch(`/api/leads/${token}/invoice`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Não foi possível enviar. Tente novamente.");
        setBusy(false);
        return;
      }
      try {
        sessionStorage.removeItem("lead_token");
      } catch {}
      if (onUploaded) onUploaded();
      else router.push(`/diagnostico/${token}`);
    } catch {
      setError("Falha de conexão. Verifique sua internet e tente novamente.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void pick(e.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Selecionar arquivo da fatura"
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        className={cn(
          "group relative flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-4 text-center transition-all",
          compact ? "py-5" : "py-7",
          dragging ? "border-primary bg-primary-soft" : error && !file ? "border-attention/60 bg-attention-soft/40" : "border-border bg-subtle/60 hover:border-primary/50 hover:bg-primary-soft/50",
        )}
      >
        <input ref={inputRef} type="file" accept={ACCEPT} capture={undefined} className="hidden" onChange={(e) => void pick(e.target.files?.[0])} />
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
            <p className="text-sm font-semibold">Arraste a fatura ou toque para escolher</p>
            <p className="mt-1 text-xs text-muted">PDF da distribuidora ou foto nítida · até 4 MB</p>
          </>
        )}
      </div>

      <Field label="Valor médio mensal da conta (opcional)" group>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {BILL_RANGES.map((r) => (
            <button
              type="button"
              key={r.value}
              onClick={() => setBillRange(billRange === r.value ? "" : r.value)}
              className={cn(
                "rounded-xl border px-3 py-2 text-left text-[13px] font-medium transition-all",
                billRange === r.value ? "border-primary bg-primary-soft text-primary ring-1 ring-primary" : "border-border hover:border-primary/40",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </Field>

      <button type="button" onClick={() => setMore((m) => !m)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
        Mais detalhes para um diagnóstico melhor (opcional) <ChevronDown className={cn("size-3.5 transition-transform", more && "rotate-180")} />
      </button>
      {more && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Empresa">
            <Input value={d.company} onChange={(e) => setD({ ...d, company: e.target.value })} autoComplete="organization" />
          </Field>
          <div className="grid grid-cols-[84px_1fr] gap-3">
            <Field label="UF">
              <Select value={d.state} onChange={(e) => setD({ ...d, state: e.target.value })}>
                <option value="">—</option>
                {UFS.map((uf) => (
                  <option key={uf}>{uf}</option>
                ))}
              </Select>
            </Field>
            <Field label="Cidade">
              <Input value={d.city} onChange={(e) => setD({ ...d, city: e.target.value })} />
            </Field>
          </div>
          <Field label="Já usa energia solar?">
            <Select value={d.solarStatus} onChange={(e) => setD({ ...d, solarStatus: e.target.value })}>
              <option value="">Prefiro não informar</option>
              {SOLAR_STATUS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Está no Mercado Livre?">
            <Select value={d.freeMarketStatus} onChange={(e) => setD({ ...d, freeMarketStatus: e.target.value })}>
              <option value="">Prefiro não informar</option>
              {FREE_MARKET_STATUS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {error && <p className="rounded-xl bg-attention-soft px-3 py-2 text-sm font-medium text-attention">{error}</p>}

      <button type="submit" disabled={busy} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 text-[15px] font-semibold text-white transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60">
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Enviando com segurança…
          </>
        ) : (
          "Gerar meu Raio-X"
        )}
      </button>
      <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted">
        <Lock className="size-3" /> Arquivo criptografado em trânsito e armazenado em ambiente privado
      </p>
    </form>
  );
}
