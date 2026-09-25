"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";

export function PrivacyRequestForm() {
  const [v, setV] = useState({ name: "", email: "", phone: "", type: "acesso", message: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/privacy-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setDone(data.protocol);
    else setError(data.error ?? "Não foi possível enviar.");
    setBusy(false);
  }

  if (done)
    return (
      <div className="rounded-2xl border border-opportunity/30 bg-opportunity-soft p-6">
        <p className="flex items-center gap-2 font-semibold text-opportunity">
          <CheckCircle2 className="size-5" /> Solicitação registrada — protocolo {done}
        </p>
        <p className="mt-2 text-sm text-foreground/80">Enviamos a confirmação para o seu e-mail. Responderemos em até 15 dias.</p>
      </div>
    );

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <input tabIndex={-1} autoComplete="off" className="hidden" aria-hidden value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome completo">
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
        </Field>
        <Field label="E-mail usado no cadastro">
          <Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} required />
        </Field>
        <Field label="WhatsApp (opcional)">
          <Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        </Field>
        <Field label="O que você deseja?">
          <Select value={v.type} onChange={(e) => setV({ ...v, type: e.target.value })}>
            <option value="acesso">Acessar meus dados</option>
            <option value="correcao">Corrigir meus dados</option>
            <option value="exclusao">Excluir meus dados</option>
            <option value="revogacao">Revogar consentimento / parar mensagens</option>
            <option value="portabilidade">Portabilidade</option>
            <option value="informacao">Informações sobre o tratamento</option>
          </Select>
        </Field>
      </div>
      <Field label="Detalhes (opcional)">
        <Textarea value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
      </Field>
      {error && <p className="text-sm font-medium text-attention">{error}</p>}
      <Button type="submit" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Enviar solicitação
      </Button>
      <p className="text-xs text-muted">Pedidos de revogação e exclusão interrompem imediatamente as mensagens automáticas. Podemos solicitar confirmação de identidade.</p>
    </form>
  );
}
