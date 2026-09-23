"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const KEY = "cookie_notice_v1";

/**
 * Aviso de cookies (LGPD). O site usa apenas cookies/armazenamento essenciais
 * (sessão do painel e continuidade do formulário). Se ferramentas de análise ou
 * anúncios forem adicionadas, elas devem ser carregadas só após o aceite.
 */
export function CookieBanner() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);
  if (!show) return null;
  const close = (value: string) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    setShow(false);
  };
  return (
    <div
      className="fixed inset-x-2 bottom-[84px] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-border bg-white/95 px-3 py-2 shadow-xl backdrop-blur sm:bottom-4 print:hidden"
      role="region"
      aria-label="Aviso de cookies"
    >
      <p className="flex-1 text-[11px] leading-snug text-foreground/80 sm:text-xs">
        Usamos só cookies essenciais, sem publicidade.{" "}
        <Link href="/privacidade" className="font-medium text-primary hover:underline">
          Privacidade
        </Link>
      </p>
      <button onClick={() => close("ok")} className="h-8 shrink-0 rounded-lg bg-foreground px-3 text-xs font-semibold text-white">
        Entendi
      </button>
    </div>
  );
}
