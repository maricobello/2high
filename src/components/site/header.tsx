import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

const NAV = [
  { href: "/#como-funciona", label: "Como funciona" },
  { href: "/gd-por-assinatura", label: "GD por assinatura" },
  { href: "/mercado-livre", label: "Mercado Livre" },
  { href: "/#faq", label: "FAQ" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-ink/85 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" aria-label="Início">
          <Logo />
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="transition-colors hover:text-white">
              {n.label}
            </Link>
          ))}
        </nav>
        <Link href="/#analisar" className={cn(buttonVariants({ size: "sm" }), "px-4")}>
          Enviar fatura
        </Link>
      </div>
    </header>
  );
}
