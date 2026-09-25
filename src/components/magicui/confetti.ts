"use client";

import confetti from "canvas-confetti";

/** Magic UI — Confetti: celebração discreta em conversões (respeita reduced-motion). */
export function celebrate() {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const colors = ["#3ee066", "#34d3f0", "#1f9d6a", "#f5b53d"];
  const end = Date.now() + 700;
  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, startVelocity: 55, origin: { x: 0, y: 0.7 }, colors, disableForReducedMotion: true });
    confetti({ particleCount: 3, angle: 120, spread: 55, startVelocity: 55, origin: { x: 1, y: 0.7 }, colors, disableForReducedMotion: true });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  frame();
}
