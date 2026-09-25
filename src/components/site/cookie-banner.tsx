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
  // Só cookies essenciais: o aviso é informativo. Fecha com Esc ou quando a pessoa começa o quiz.
  // No celular fica no topo, sobre o cabeçalho, para não cobrir as opções do quiz.
  useEffect(() => {
    if (!show) return;
    const dismiss = () => {
      try {
        localStorage.setItem(KEY, "ok");
      } catch {}
      setShow(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && dismiss();
    const onClick = (e: MouseEvent) => (e.target as Element | null)?.closest?.("[role=radio]") && dismiss();
    // ao rolar além do topo, sai da frente da barra fixa de CTA
    const onScroll = () => window.scrollY > 600 && dismiss();
    document.addEventListener("keydown", onKey);
    document.addEventListener("click", onClick, true);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("scroll", onScroll);
    };
  }, [show]);
  if (!show) return null;
  const close = (value: string) => {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    setShow(false);
  };
  return (
    <div
      className="fixed inset-x-2 top-2 z-50 mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-border bg-card/95 px-3 py-2 shadow-xl backdrop-blur md:top-auto md:bottom-4 print:hidden"
      role="region"
      aria-label="Aviso de cookies"
    >
      <p className="flex-1 text-[11px] leading-snug text-foreground/80 sm:text-xs">
        Usamos só cookies essenciais, sem publicidade.{" "}
        <Link href="/privacidade" className="font-medium text-primary hover:underline">
          Privacidade
        </Link>
      </p>
      <button onClick={() => close("ok")} className="min-h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
        Entendi
      </button>
    </div>
  );
}
