"use client";

import { motion, useInView } from "motion/react";
import { useRef } from "react";

/** Magic UI — Blur Fade: entrada suave ao rolar a página. */
export function BlurFade({ children, className, delay = 0, yOffset = 10, inViewMargin = "-60px" }: { children: React.ReactNode; className?: string; delay?: number; yOffset?: number; inViewMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: inViewMargin as `${number}px` });
  return (
    <motion.div
      ref={ref}
      initial={{ y: yOffset, opacity: 0, filter: "blur(6px)" }}
      animate={inView ? { y: 0, opacity: 1, filter: "blur(0px)" } : undefined}
      transition={{ delay: 0.04 + delay, duration: 0.45, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
