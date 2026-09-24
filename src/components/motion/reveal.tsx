"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { gsap, prefersReducedMotion, useGSAP } from "./gsap";

/**
 * Entrada em sequência dos filhos marcados com `data-reveal-item`
 * quando o bloco entra na tela (sobe 28px + fade, com stagger).
 */
export function Reveal({ children, className, stagger = 0.09, delay = 0 }: { children: React.ReactNode; className?: string; stagger?: number; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      const items = ref.current?.querySelectorAll<HTMLElement>("[data-reveal-item]");
      if (!items?.length) return;
      if (prefersReducedMotion()) {
        gsap.set(items, { opacity: 1 });
        return;
      }
      gsap.fromTo(
        items,
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, ease: "power3.out", stagger, delay, scrollTrigger: { trigger: ref.current, start: "top 85%", once: true } },
      );
    },
    { scope: ref },
  );
  return (
    <div ref={ref} className={cn(className)}>
      {children}
    </div>
  );
}
