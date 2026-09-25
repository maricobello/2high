"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { brand } from "@/lib/brand";
import { Logo } from "./logo";

const NAV = [
  { href: "/#raio-x", label: "Raio-X" },
  { href: "/#como-funciona", label: "Como funciona" },
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
        <div inert={scrolled} className={cn("overflow-hidden border-b border-white/5 bg-ink-2 text-white/80 transition-[max-height] duration-300", scrolled ? "max-h-0" : "max-h-10")}>
          <Link href="/#analisar" className="mx-auto flex h-9 max-w-6xl items-center justify-center gap-2 px-4 text-[13px] font-medium hover:text-white">
            <span className="truncate">Faturas dos últimos 5 anos ainda podem ser revisadas</span>
            <ArrowRight className="hidden size-3.5 sm:block" />
          </Link>
        </div>
      )}
      <div className={cn("border-b transition-all duration-300", scrolled ? "border-white/10 bg-ink/95 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl" : "border-transparent bg-ink")}>
        <div className={cn("mx-auto flex max-w-7xl items-center justify-between px-4 transition-[height] duration-300 sm:px-6 lg:px-10", scrolled ? "h-16" : "h-[72px]")}>
          <Link href="/" aria-label={`${brand.name} — início`} className="flex">
            <Logo className="[&>span>svg:nth-child(2)]:hidden sm:[&>span>svg:nth-child(2)]:block" />
          </Link>
          <nav className="hidden items-center gap-9 text-[15px] font-medium text-white/85 md:flex">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="transition-colors hover:text-primary">
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/#analisar"
            className="group inline-flex h-10 items-center gap-2 rounded-full bg-primary px-4 text-[12px] font-bold uppercase tracking-[0.08em] text-primary-foreground shadow-[0_0_24px_-6px_rgba(62,224,102,0.6)] transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40 sm:h-11 sm:px-6 sm:text-[13px]"
          >
            Fazer diagnóstico <ArrowRight className="hidden size-4 transition-transform group-hover:translate-x-0.5 sm:block" />
          </Link>
        </div>
      </div>
    </header>
  );
}
