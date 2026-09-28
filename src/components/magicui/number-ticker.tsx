"use client";

import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/** Magic UI — Number Ticker: anima o número quando entra na tela. */
export function NumberTicker({ value, decimalPlaces = 0, className, prefix = "", suffix = "" }: { value: number; decimalPlaces?: number; className?: string; prefix?: string; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  // Mola levemente superamortecida (sem passar do valor) e parada proporcional ao número:
  // conta em ~1 s mesmo para valores grandes (R$ milhões), sem cauda longa.
  const spring = useSpring(motionValue, { damping: 26, stiffness: 120, restDelta: Math.max(0.01, Math.abs(value) / 2000), restSpeed: Math.max(0.01, Math.abs(value) / 1000) });
  const inView = useInView(ref, { once: true, margin: "0px" });
  const fmt = (n: number) => `${prefix}${Intl.NumberFormat("pt-BR", { minimumFractionDigits: decimalPlaces, maximumFractionDigits: decimalPlaces }).format(n)}${suffix}`;

  const reduce = useReducedMotion();

  useEffect(() => {
    if (!inView) return;
    // "Reduzir movimento": mostra o valor final, sem contagem
    if (reduce) spring.jump(value);
    else motionValue.set(value);
  }, [inView, motionValue, spring, reduce, value]);

  useEffect(
    () =>
      spring.on("change", (latest) => {
        if (ref.current) ref.current.textContent = fmt(Number(latest.toFixed(decimalPlaces)));
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [spring, decimalPlaces],
  );

  return (
    <span ref={ref} className={cn("inline-block tabular-nums tracking-tight", className)}>
      {fmt(0)}
    </span>
  );
}
