"use client";

import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/#exemplos", label: "Exemplos" },
  { href: "/#faq", label: "Perguntas" },
];

/** Header sticky com estado de scroll (compacta + ganha borda/sombra) e barra de anúncio na home. */
export function SiteHeader() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      {path === "/" && (
        <div className={cn("overflow-hidden bg-primary text-white transition-[max-height] duration-300", scrolled ? "max-h-0" : "max-h-10")}>
          <Link href="/#analisar" className="mx-auto flex h-9 max-w-6xl items-center justify-center gap-2 px-4 text-[12.5px] font-semibold">
            <Zap className="size-3.5 text-volt" />
            <span className="truncate">Faturas antigas têm prazo para revisão</span>
            <ArrowRight className="hidden size-3.5 sm:block" />
          </Link>
        </div>
      )}
      <div className={cn("border-b transition-all duration-300", scrolled ? "border-white/10 bg-ink/95 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl" : "border-transparent bg-ink")}>
        <div className={cn("mx-auto flex max-w-6xl items-center justify-between px-4 transition-[height] duration-300 sm:px-6", scrolled ? "h-14" : "h-16")}>
          <Link href="/" aria-label="Início">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-7 text-sm font-medium text-white/80 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition-colors hover:text-white">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/#analisar"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-white px-4 text-sm font-bold text-ink shadow-[0_6px_20px_-6px_rgba(255,255,255,0.4)] transition-transform hover:-translate-y-0.5"
          >
            Fazer diagnóstico
          </Link>
        </div>
      </div>
    </header>
  );
}
