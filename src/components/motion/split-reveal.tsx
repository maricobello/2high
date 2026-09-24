"use client";

import { useRef } from "react";
import { gsap, prefersReducedMotion, SplitText, useGSAP } from "./gsap";

type Tag = "h1" | "h2" | "h3" | "p" | "blockquote" | "span";

/**
 * Revelação por linhas com máscara (SplitText): cada linha sobe por trás de
 * um recorte. `immediate` anima ao carregar; senão, quando entra na tela.
 */
export function SplitReveal({
  as = "h2",
  children,
  className,
  immediate = false,
  delay = 0,
}: {
  as?: Tag;
  children: React.ReactNode;
  className?: string;
  immediate?: boolean;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const el = ref.current;
      if (!el) return;
      if (prefersReducedMotion()) {
        el.setAttribute("data-split-ready", "");
        return;
      }
      SplitText.create(el, {
        type: "lines",
        mask: "lines",
        autoSplit: true,
        onSplit(self) {
          el.setAttribute("data-split-ready", "");
          return gsap.from(self.lines, {
            yPercent: 110,
            duration: 1.1,
            ease: "expo.out",
            stagger: 0.09,
            delay,
            scrollTrigger: immediate ? undefined : { trigger: el, start: "top 88%", once: true },
          });
        },
      });
    },
    { scope: ref },
  );

  const Tag = as;
  return (
    <Tag ref={ref as React.Ref<never>} className={className} data-split="">
      {children}
    </Tag>
  );
}
