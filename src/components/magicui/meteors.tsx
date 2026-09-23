"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Magic UI — Meteors (gerados no cliente para evitar divergência de hidratação). */
export function Meteors({ number = 18, className }: { number?: number; className?: string }) {
  const [styles, setStyles] = useState<React.CSSProperties[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStyles(
      Array.from({ length: number }, () => ({
        top: "-5%",
        left: `${Math.floor(Math.random() * 110) - 5}%`,
        animationDelay: `${(Math.random() * 1.5 + 0.2).toFixed(2)}s`,
        animationDuration: `${Math.floor(Math.random() * 6 + 3)}s`,
      })),
    );
  }, [number]);
  return (
    <>
      {styles.map((style, i) => (
        <span key={i} style={style} className={cn("pointer-events-none absolute size-0.5 rotate-[215deg] animate-meteor rounded-full bg-cyan/80 shadow-[0_0_0_1px_#ffffff10]", className)}>
          <span className="pointer-events-none absolute top-1/2 -z-10 h-px w-[60px] -translate-y-1/2 bg-gradient-to-r from-cyan/70 to-transparent" />
        </span>
      ))}
    </>
  );
}
