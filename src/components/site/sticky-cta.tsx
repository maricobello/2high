"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

/** Barra fixa no mobile: aparece depois que o diagnóstico do topo sai da tela. */
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
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 p-3 pr-20 backdrop-blur transition-transform duration-300 md:hidden ${show ? "translate-y-0" : "translate-y-full"}`}
    >
      <a href="#analisar" className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[15px] font-medium text-white">
        Iniciar diagnóstico gratuito <ArrowRight className="size-4" />
      </a>
    </div>
  );
}
