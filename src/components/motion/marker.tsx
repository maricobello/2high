"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Marca-texto amarelo que se desenha quando o trecho entra na tela. */
export function Marker({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setOn(true), io.disconnect()), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <span ref={ref} data-on={on} className={cn("marker", className)}>
      {children}
    </span>
  );
}
