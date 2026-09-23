"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

/** Barra fixa no mobile: aparece depois que o formulário do hero sai da tela. */
export function StickyCta() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const hero = document.getElementById("analisar");
    if (!hero) return;
    const obs = new IntersectionObserver(([e]) => setShow(!e.isIntersecting), { threshold: 0.05 });
    obs.observe(hero);
    return () => obs.disconnect();
  }, []);
  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 p-3 pr-20 backdrop-blur transition-transform duration-300 md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <a href="#analisar" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-white shadow-lg shadow-primary/30">
        AUDITAR MINHA FATURA GRÁTIS <ArrowRight className="size-4" />
      </a>
    </div>
  );
}
