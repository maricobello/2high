"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "./gsap";

/** Frase que "acende" palavra por palavra conforme a rolagem (scrub). */
export function ScrubWords({ children, className }: { children: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      el.setAttribute("data-split-ready", "");
      if (prefersReducedMotion()) return;
      const split = SplitText.create(el, { type: "words" });
      gsap.fromTo(
        split.words,
        { opacity: 0.14 },
        { opacity: 1, ease: "none", stagger: 0.1, scrollTrigger: { trigger: el, start: "top 80%", end: "bottom 50%", scrub: 0.6 } },
      );
    },
    { scope: ref },
  );
  return (
    <p ref={ref} className={className} data-split="">
      {children}
    </p>
  );
}
