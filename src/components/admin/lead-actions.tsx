"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { STAGES, type Stage } from "@/modules/leads/types";

interface Props {
  id: string;
  stage: Stage;
  owner: string | null;
  partnerId: string | null;
  potentialValue: number | null;
  potentialCommission: number | null;
  notes: string | null;
  followUpOptOut: boolean;
  partners: { id: string; name: string }[];
}

export function LeadActions(p: Props) {
  const router = useRouter();
  const [v, setV] = useState({
    stage: p.stage,
    owner: p.owner ?? "",
    partnerId: p.partnerId ?? "",
    potentialValue: p.potentialValue?.toString() ?? "",
    potentialCommission: p.potentialCommission?.toString() ?? "",
    notes: p.notes ?? "",
    followUpOptOut: p.followUpOptOut,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/leads/${p.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stage: v.stage,
        owner: v.owner || null,
        partnerId: v.partnerId || null,
        potentialValue: v.potentialValue ? Number(v.potentialValue) : null,
        potentialCommission: v.potentialCommission ? Number(v.potentialCommission) : null,
        notes: v.notes || null,
        followUpOptOut: v.followUpOptOut,
      }),
    });
    setBusy(false);
    setMsg(res.ok ? "Salvo." : "Erro ao salvar.");
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-3">
      <Field label="Estágio">
        <Select value={v.stage} onChange={(e) => setV({ ...v, stage: e.target.value as Stage })}>
          {STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Responsável">
        <Input value={v.owner} onChange={(e) => setV({ ...v, owner: e.target.value })} placeholder="Nome do vendedor" />
      </Field>
      <Field label="Parceiro responsável">
        <Select value={v.partnerId} onChange={(e) => setV({ ...v, partnerId: e.target.value })}>
          <option value="">—</option>
          {p.partners.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor potencial (R$/ano)">
          <Input inputMode="decimal" value={v.potentialValue} onChange={(e) => setV({ ...v, potentialValue: e.target.value })} />
        </Field>
        <Field label="Comissão potencial (R$)">
          <Input inputMode="decimal" value={v.potentialCommission} onChange={(e) => setV({ ...v, potentialCommission: e.target.value })} />
        </Field>
      </div>
      <Field label="Observações">
        <Textarea value={v.notes} onChange={(e) => setV({ ...v, notes: e.target.value })} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-primary" checked={v.followUpOptOut} onChange={(e) => setV({ ...v, followUpOptOut: e.target.checked })} />
        Pausar follow-up automático
      </label>
      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" />} Salvar
        </Button>
        {msg && <span className="text-sm text-muted">{msg}</span>}
      </div>
    </div>
  );
}

export function ActivityForm({ id }: { id: string }) {
  const router = useRouter();
  const [type, setType] = useState<"note" | "contact">("contact");
  const [channel, setChannel] = useState("whatsapp");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setBusy(true);
    const res = await fetch(`/api/admin/leads/${id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, channel: type === "contact" ? channel : null, content }),
    });
    setBusy(false);
    if (res.ok) {
      setContent("");
      router.refresh();
    }
  }
  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as "note" | "contact")} className="h-9 w-40 text-sm">
          <option value="contact">Contato realizado</option>
          <option value="note">Nota interna</option>
        </Select>
        {type === "contact" && (
          <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 w-36 text-sm">
            <option value="whatsapp">WhatsApp</option>
            <option value="telefone">Telefone</option>
            <option value="email">E-mail</option>
            <option value="reuniao">Reunião</option>
            <option value="outro">Outro</option>
          </Select>
        )}
      </div>
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="O que foi conversado / próximos passos" className="min-h-20 text-sm" />
      <Button size="sm" type="submit" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Registrar
      </Button>
    </form>
  );
}

export function ReprocessButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/admin/leads/${id}/reprocess`, { method: "POST" });
        setTimeout(() => {
          setBusy(false);
          router.refresh();
        }, 4000);
      }}
    >
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} /> Reprocessar
    </Button>
  );
}
