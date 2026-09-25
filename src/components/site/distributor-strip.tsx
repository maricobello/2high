"use client";

import { Pause, Play } from "lucide-react";
import { useState } from "react";
import { Marquee } from "@/components/magicui/marquee";
import { cn } from "@/lib/utils";

/** Faixa de distribuidoras em movimento, com controle de pausa (WCAG 2.2.2). */
export function DistributorStrip({ names }: { names: string[] }) {
  const [paused, setPaused] = useState(false);
  return (
    <div className="relative border-t border-white/10 bg-white/[0.02] py-5">
      <div className="mb-3 flex items-center justify-center gap-2">
        <p className="text-[12px] font-medium text-white/60">Lemos faturas de</p>
        <button
          type="button"
          onClick={() => setPaused((p) => !p)}
          aria-label={paused ? "Retomar animação da lista de distribuidoras" : "Pausar animação da lista de distribuidoras"}
          className="flex size-6 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          {paused ? <Play className="size-3" /> : <Pause className="size-3" />}
        </button>
      </div>
      <Marquee
        className={cn(
          "[--duration:70s] [--gap:3rem] [mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
          paused && "[&_.animate-marquee]:[animation-play-state:paused]",
        )}
      >
        {names.map((n) => (
          <span key={n} className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-white/65">
            {n}
          </span>
        ))}
      </Marquee>
    </div>
  );
}
