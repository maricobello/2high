"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Conversa demonstrativa com efeito de digitação (loop quando visível). */
const SCRIPT = [
  { me: true, text: "É gratuito mesmo?" },
  { me: false, text: "Sim! A análise preliminar da fatura é gratuita e sem compromisso." },
  { me: true, text: "Preciso instalar placas?" },
  { me: false, text: "Não. Na energia por assinatura os créditos vêm de usinas remotas — sem obra no seu imóvel." },
  { me: true, text: "Quero falar com alguém" },
  { me: false, text: "Claro! Chamo um especialista no WhatsApp agora." },
];

export function ChatDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-60px" });
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setN((x) => (x >= SCRIPT.length + 2 ? 0 : x + 1)), 1300);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const shown = reduce ? SCRIPT : SCRIPT.slice(0, Math.min(n, SCRIPT.length));
  const typing = !reduce && n < SCRIPT.length && SCRIPT[n] && !SCRIPT[n].me;

  return (
    <div ref={ref} className="relative rounded-3xl border border-white/10 bg-ink-2 p-4 shadow-2xl">
      <div className="mb-3 flex items-center gap-2.5 border-b border-white/10 pb-3">
        <span className="flex size-8 items-center justify-center rounded-full bg-primary text-white">
          <Bot className="size-4" />
        </span>
        <div>
          <p className="text-sm font-semibold text-white">Assistente de energia</p>
          <p className="text-[11px] text-opportunity">● online agora</p>
        </div>
      </div>
      <div className="flex min-h-[250px] flex-col justify-end gap-2 text-sm">
        <AnimatePresence initial={false}>
          {shown.map((m, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={cn("max-w-[85%] rounded-2xl px-3.5 py-2", m.me ? "ml-auto rounded-tr-md bg-primary text-white" : "rounded-tl-md bg-white/10 text-white")}
            >
              {m.text}
            </motion.div>
          ))}
        </AnimatePresence>
        {typing && (
          <div className="flex w-fit gap-1 rounded-2xl bg-white/10 px-3.5 py-3" aria-hidden>
            {[0, 1, 2].map((d) => (
              <motion.span key={d} className="size-1.5 rounded-full bg-white/70" animate={{ y: [0, -4, 0] }} transition={{ repeat: Infinity, duration: 0.8, delay: d * 0.15 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
