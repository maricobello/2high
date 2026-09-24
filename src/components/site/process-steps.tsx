"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, ScrollTrigger, useGSAP } from "@/components/motion/gsap";

export interface ProcessStep {
  title: string;
  text: string;
  meta: string;
}

/** Etapas com linha de progresso preenchida pela rolagem; cada etapa "acende" ao ser alcançada. */
export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  const ref = useRef<HTMLOListElement>(null);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const items = root.querySelectorAll<HTMLElement>("[data-step]");
      if (prefersReducedMotion()) {
        items.forEach((i) => i.setAttribute("data-active", "true"));
        gsap.set("[data-fill]", { scaleY: 1 });
        return;
      }
      gsap.fromTo("[data-fill]", { scaleY: 0 }, { scaleY: 1, ease: "none", scrollTrigger: { trigger: root, start: "top 70%", end: "bottom 60%", scrub: 0.5 } });
      items.forEach((item) =>
        ScrollTrigger.create({
          trigger: item,
          start: "top 68%",
          onEnter: () => item.setAttribute("data-active", "true"),
          onLeaveBack: () => item.setAttribute("data-active", "false"),
        }),
      );
    },
    { scope: ref },
  );

  return (
    <ol ref={ref} className="relative">
      <span aria-hidden className="absolute bottom-6 left-[19px] top-6 w-px bg-line" />
      <span aria-hidden data-fill className="absolute bottom-6 left-[19px] top-6 w-px origin-top scale-y-0 bg-ink" />
      {steps.map((s, i) => (
        <li key={s.title} data-step data-active="false" className="group relative grid grid-cols-[40px_1fr] gap-5 pb-12 last:pb-0">
          <span className="relative z-10 flex size-10 items-center justify-center rounded-full border border-line bg-paper font-mono text-[13px] text-stone transition-colors duration-500 group-data-[active=true]:border-ink group-data-[active=true]:bg-ink group-data-[active=true]:text-white">
            {String(i + 1).padStart(2, "0")}
          </span>
          <div className="pt-1.5 transition-opacity duration-500 group-data-[active=false]:opacity-45">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-stone">{s.meta}</p>
            <h3 className="mt-1.5 text-2xl font-medium tracking-[-0.02em]">{s.title}</h3>
            <p className="mt-2 max-w-md text-[15px] leading-relaxed text-stone">{s.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
