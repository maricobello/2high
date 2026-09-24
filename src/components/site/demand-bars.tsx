"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Mini gráfico de demanda: barras crescem ao entrar na tela (stagger); picos acima do contrato em vermelho. */
export function DemandBars() {
  const bars = [62, 70, 66, 74, 81, 108, 72, 69, 77, 112, 70, 64];
  return (
    <div className="relative flex h-28 items-end gap-1.5" aria-hidden>
      <div className="absolute inset-x-0 border-t-2 border-dashed border-attention/70" style={{ bottom: `${(100 / 115) * 100}%` }}>
        <span className="absolute -top-5 right-0 text-[10px] font-bold uppercase tracking-wider text-attention">demanda contratada</span>
      </div>
      {bars.map((b, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          whileInView={{ scaleY: 1 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ delay: i * 0.05, type: "spring", stiffness: 160, damping: 18 }}
          className={cn("flex-1 origin-bottom rounded-t-md", b > 100 ? "bg-attention" : "bg-primary/30")}
          style={{ height: `${(b / 115) * 100}%` }}
        />
      ))}
    </div>
  );
}
