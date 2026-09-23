"use client";

import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { useRef } from "react";

/** Linha do tempo com progresso ligado ao scroll (scroll-linked animation). */
export function ScrollTimeline({ steps }: { steps: { title: string; text: string; time: string }[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 75%", "end 55%"] });
  const scaleY = useSpring(useTransform(scrollYProgress, [0, 1], [0, 1]), { stiffness: 120, damping: 30 });

  return (
    <ol ref={ref} className="relative mx-auto max-w-2xl">
      <div className="absolute bottom-6 left-[27px] top-6 w-0.5 bg-border" aria-hidden />
      <motion.div className="absolute bottom-6 left-[27px] top-6 w-0.5 origin-top bg-gradient-to-b from-primary to-cyan" style={{ scaleY }} aria-hidden />
      {steps.map((s, i) => (
        <li key={s.title} className="relative flex gap-6 pb-12 last:pb-0">
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-120px" }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative z-10 flex size-14 shrink-0 items-center justify-center rounded-2xl bg-ink text-lg font-bold text-volt shadow-lg shadow-primary/20"
          >
            {i + 1}
          </motion.span>
          <motion.div initial={{ opacity: 0, x: 16 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: "-120px" }} transition={{ duration: 0.5, ease: "easeOut" }} className="pt-1.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{s.time}</p>
            <p className="mt-1 text-xl font-bold tracking-tight">{s.title}</p>
            <p className="mt-1.5 max-w-md text-[15px] leading-relaxed text-muted">{s.text}</p>
          </motion.div>
        </li>
      ))}
    </ol>
  );
}
