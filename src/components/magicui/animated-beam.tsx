"use client";

import { motion } from "motion/react";
import { useEffect, useId, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

/** Magic UI — Animated Beam: feixe animado ligando dois elementos. */
export function AnimatedBeam({
  className,
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  reverse = false,
  duration = 4,
  delay = 0,
  pathColor = "#94a3b8",
  pathWidth = 2,
  pathOpacity = 0.2,
  gradientStartColor = "#34d3f0",
  gradientStopColor = "#3d5afe",
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
}: {
  className?: string;
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  reverse?: boolean;
  duration?: number;
  delay?: number;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
}) {
  const id = useId();
  const [pathD, setPathD] = useState("");
  const [box, setBox] = useState({ width: 0, height: 0 });

  const coords = reverse
    ? { x1: ["90%", "-10%"], x2: ["100%", "0%"], y1: ["0%", "0%"], y2: ["0%", "0%"] }
    : { x1: ["10%", "110%"], x2: ["0%", "100%"], y1: ["0%", "0%"], y2: ["0%", "0%"] };

  useEffect(() => {
    const update = () => {
      const c = containerRef.current;
      const a = fromRef.current;
      const b = toRef.current;
      if (!c || !a || !b) return;
      const cr = c.getBoundingClientRect();
      const ar = a.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      setBox({ width: cr.width, height: cr.height });
      const sx = ar.left - cr.left + ar.width / 2 + startXOffset;
      const sy = ar.top - cr.top + ar.height / 2 + startYOffset;
      const ex = br.left - cr.left + br.width / 2 + endXOffset;
      const ey = br.top - cr.top + br.height / 2 + endYOffset;
      const cy = sy - curvature;
      setPathD(`M ${sx},${sy} Q ${(sx + ex) / 2},${cy} ${ex},${ey}`);
    };
    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    update();
    return () => ro.disconnect();
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset]);

  return (
    <svg fill="none" width={box.width} height={box.height} xmlns="http://www.w3.org/2000/svg" className={cn("pointer-events-none absolute left-0 top-0 transform-gpu stroke-2", className)} viewBox={`0 0 ${box.width} ${box.height}`}>
      <path d={pathD} stroke={pathColor} strokeWidth={pathWidth} strokeOpacity={pathOpacity} strokeLinecap="round" />
      <path d={pathD} strokeWidth={pathWidth} stroke={`url(#${id})`} strokeOpacity="1" strokeLinecap="round" />
      <defs>
        <motion.linearGradient
          className="transform-gpu"
          id={id}
          gradientUnits="userSpaceOnUse"
          initial={{ x1: "0%", x2: "0%", y1: "0%", y2: "0%" }}
          animate={{ x1: coords.x1, x2: coords.x2, y1: coords.y1, y2: coords.y2 }}
          transition={{ delay, duration, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 0 }}
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop stopColor={gradientStartColor} />
          <stop offset="32.5%" stopColor={gradientStopColor} />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </motion.linearGradient>
      </defs>
    </svg>
  );
}
