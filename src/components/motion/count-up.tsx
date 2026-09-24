"use client";

import NumberFlow from "@number-flow/react";

type FlowFormat = React.ComponentProps<typeof NumberFlow>["format"];
import { useEffect, useRef, useState } from "react";

/** Número que conta ao entrar na tela (NumberFlow, formatação pt-BR). */
export function CountUp({ value, prefix, suffix, className, format }: { value: number; prefix?: string; suffix?: string; className?: string; format?: FlowFormat }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setShown(value), io.disconnect()), { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return (
    <span ref={ref} className={className}>
      <NumberFlow value={shown} locales="pt-BR" prefix={prefix} suffix={suffix} format={format ?? { maximumFractionDigits: 0 }} />
    </span>
  );
}
