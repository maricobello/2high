"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * Magic UI "Magic Card" / 21st.dev "Spotlight card": gradiente radial que segue o
 * cursor (via CSS custom properties, sem re-render do React).
 */
export function SpotlightCard({ children, className, dark = false }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div
      ref={ref}
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r || !ref.current) return;
        ref.current.style.setProperty("--mx", `${e.clientX - r.left}px`);
        ref.current.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1",
        dark ? "border-white/10 bg-ink-2 text-white hover:border-white/20" : "border-border bg-card hover:border-primary/30 hover:shadow-[0_20px_50px_-20px_rgba(62,224,102,0.35)]",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), ${dark ? "rgba(52,211,240,0.14)" : "rgba(62,224,102,0.10)"}, transparent 45%)`,
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
