"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.href = next && next.startsWith("/admin") ? next : "/admin";
      return;
    }
    setError((await res.json()).error ?? "Falha no login.");
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-3xl bg-white p-7 shadow-2xl">
      <div>
        <p className="text-lg font-semibold">Painel comercial</p>
        <p className="text-sm text-muted">Acesso restrito à equipe.</p>
      </div>
      <Field label="E-mail">
        <Input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </Field>
      <Field label="Senha">
        <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </Field>
      {error && <p className="text-sm font-medium text-attention">{error}</p>}
      <Button type="submit" className="w-full" size="lg" disabled={busy}>
        {busy && <Loader2 className="size-4 animate-spin" />} Entrar
      </Button>
    </form>
  );
}
