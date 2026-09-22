"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EraseLeadButton({ id, protocol }: { id: string; protocol: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      className="text-attention"
      onClick={async () => {
        const typed = window.prompt(`Exclusão DEFINITIVA de todos os dados e arquivos do lead (LGPD). Digite o protocolo ${protocol} para confirmar:`);
        if (typed?.trim() !== protocol) return;
        setBusy(true);
        const res = await fetch(`/api/admin/leads/${id}/erase`, { method: "POST" });
        if (res.ok) router.push("/admin/lgpd");
        else {
          alert("Falha ao excluir.");
          setBusy(false);
        }
      }}
    >
      <Trash2 className="size-4" /> Excluir dados (LGPD)
    </Button>
  );
}

export function RequestStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  return (
    <select
      defaultValue={status}
      className="h-8 rounded-lg border border-border bg-white px-2 text-xs"
      onChange={async (e) => {
        await fetch("/api/admin/privacy-requests", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: e.target.value }) });
        router.refresh();
      }}
    >
      <option value="aberta">Aberta</option>
      <option value="em_andamento">Em andamento</option>
      <option value="concluida">Concluída</option>
      <option value="recusada">Recusada</option>
    </select>
  );
}
