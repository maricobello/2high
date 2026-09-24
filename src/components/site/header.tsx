"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/#metodo", label: "Método" },
  { href: "/#como-funciona", label: "Como trabalhamos" },
  { href: "/#casos", label: "Casos" },
  { href: "/#faq", label: "Dúvidas" },
];

/** Header sticky com estado de scroll (compacta + ganha borda/desfoque). */
export function SiteHeader() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  // Home: header claro sobre o papel; demais páginas mantêm o header escuro.
  const light = path === "/";

  return (
    <header className="sticky top-0 z-40">
      <div
        className={cn(
          "border-b transition-all duration-300",
          light
            ? scrolled
              ? "border-line bg-paper/85 backdrop-blur-xl"
              : "border-transparent bg-paper"
            : scrolled
              ? "border-white/10 bg-ink/95 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-xl"
              : "border-transparent bg-ink",
        )}
      >
        <div className={cn("mx-auto flex max-w-6xl items-center justify-between px-4 transition-[height] duration-300 sm:px-6", scrolled ? "h-14" : "h-16")}>
          <Link href="/" aria-label="Início">
            <Logo dark={!light} />
          </Link>
          <nav className={cn("hidden items-center gap-7 text-sm md:flex", light ? "text-stone" : "text-white/80")}>
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={cn("transition-colors", light ? "hover:text-foreground" : "hover:text-white")}>
                {n.label}
              </Link>
            ))}
          </nav>
          <Link
            href="/#analisar"
            className={cn(
              "group inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors",
              light ? "bg-ink text-white hover:bg-ink/85" : "bg-white text-ink hover:bg-white/90",
            )}
          >
            Iniciar diagnóstico <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}
