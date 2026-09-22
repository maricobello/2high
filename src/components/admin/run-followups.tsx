"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function RunFollowUps() {
  const [out, setOut] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const res = await fetch("/api/admin/follow-ups", { method: "POST" });
          setOut(JSON.stringify(await res.json()));
          setBusy(false);
        }}
      >
        Processar follow-ups vencidos agora
      </Button>
      {out && <code className="text-xs text-muted">{out}</code>}
    </div>
  );
}
