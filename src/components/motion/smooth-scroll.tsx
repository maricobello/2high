"use client";

import Lenis from "lenis";
import { useEffect } from "react";
import { gsap, prefersReducedMotion, ScrollTrigger } from "./gsap";

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

const HEADER_OFFSET = -88;

/** Rolagem suave (Lenis) sincronizada com o ScrollTrigger. Desligada com movimento reduzido. */
export function SmoothScroll() {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ duration: 1.1, autoRaf: false, anchors: { offset: HEADER_OFFSET } });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      delete window.__lenis;
    };
  }, []);
  return null;
}

/** Rola até o elemento usando o Lenis quando ativo. */
export function scrollToElement(el: HTMLElement | null) {
  if (!el) return;
  if (window.__lenis) window.__lenis.scrollTo(el, { offset: HEADER_OFFSET });
  else el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
}
