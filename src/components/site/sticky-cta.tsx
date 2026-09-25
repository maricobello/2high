"use client";

import { ArrowRight, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import { QUIZ_PROGRESS_EVENT } from "@/lib/client/open-analysis";
import { cn } from "@/lib/utils";

/**
 * Atalho de volta ao quiz quando o hero sai da tela: barra fixa no celular e
 * botão discreto no canto inferior esquerdo no computador. Mostra onde a pessoa parou.
 */
export function StickyCta() {
  const [show, setShow] = useState(false);
  const [label, setLabel] = useState("Fazer diagnóstico");
  useEffect(() => {
    const hero = document.getElementById("analisar");
    if (!hero) return;
    const obs = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0.05 });
    obs.observe(hero);
    const onProgress = (e: Event) => setLabel((e as CustomEvent<string>).detail);
    window.addEventListener(QUIZ_PROGRESS_EVENT, onProgress);
    return () => {
      obs.disconnect();
      window.removeEventListener(QUIZ_PROGRESS_EVENT, onProgress);
    };
  }, []);
  return (
    <>
      <div
        inert={!show}
        className={cn("fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 p-3 pr-20 backdrop-blur transition-all duration-300 md:hidden print:hidden", show ? "visible translate-y-0" : "invisible translate-y-full")}
      >
        <a href="#analisar" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/30">
          {label} <ArrowRight className="size-4" />
        </a>
      </div>
      <a
        href="#analisar"
        inert={!show}
        className={cn(
          "fixed bottom-6 left-6 z-30 hidden h-10 items-center gap-2 rounded-full border border-border bg-white/90 pl-3 pr-4 text-[13px] font-semibold text-foreground shadow-lg backdrop-blur transition-all duration-300 hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 md:inline-flex print:hidden",
          show ? "visible translate-y-0 opacity-100" : "pointer-events-none invisible translate-y-2 opacity-0",
        )}
      >
        <ArrowUp className="size-4 text-primary" /> {label}
      </a>
    </>
  );
}
