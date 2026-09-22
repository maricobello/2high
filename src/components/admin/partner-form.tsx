"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/field";

export function PartnerForm() {
  const router = useRouter();
  const [v, setV] = useState({ name: "", kind: "comercializadora", contactEmail: "", contactPhone: "", commissionRate: "" });
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    const res = await fetch("/api/admin/partners", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...v,
        contactEmail: v.contactEmail || null,
        contactPhone: v.contactPhone || null,
        commissionRate: v.commissionRate ? Number(v.commissionRate) / 100 : null,
      }),
    });
    if (res.ok) {
      setV({ name: "", kind: "comercializadora", contactEmail: "", contactPhone: "", commissionRate: "" });
      router.refresh();
    } else setErr((await res.json()).error ?? "Erro");
  }
  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
      <Field label="Nome" className="lg:col-span-2">
        <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} required />
      </Field>
      <Field label="Tipo">
        <Select value={v.kind} onChange={(e) => setV({ ...v, kind: e.target.value })}>
          <option value="comercializadora">Comercializadora</option>
          <option value="gd">Projeto de GD</option>
          <option value="consultoria">Consultoria</option>
          <option value="representante">Representante</option>
          <option value="outro">Outro</option>
        </Select>
      </Field>
      <Field label="E-mail">
        <Input value={v.contactEmail} onChange={(e) => setV({ ...v, contactEmail: e.target.value })} />
      </Field>
      <Field label="Comissão (%)">
        <Input inputMode="decimal" value={v.commissionRate} onChange={(e) => setV({ ...v, commissionRate: e.target.value })} />
      </Field>
      <Button type="submit">Adicionar</Button>
      {err && <p className="text-sm text-attention">{err}</p>}
    </form>
  );
}
