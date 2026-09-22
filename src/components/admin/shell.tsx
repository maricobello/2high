"use client";

import { KanbanSquare, LogOut, PlugZap, Rows3, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Pipeline", icon: KanbanSquare, exact: true },
  { href: "/admin/leads", label: "Leads", icon: Rows3 },
  { href: "/admin/parceiros", label: "Parceiros", icon: Users },
  { href: "/admin/lgpd", label: "LGPD", icon: ShieldCheck },
  { href: "/admin/integracoes", label: "Integrações", icon: PlugZap },
];

export function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-white/5 bg-ink text-white">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center gap-6 px-4">
          <Link href="/admin">
            <Logo className="[&_span]:text-[15px]" />
          </Link>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {NAV.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? path === href : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors", active ? "bg-white/10 text-white" : "text-white/60 hover:text-white")}
                >
                  <Icon className="size-4" /> {label}
                </Link>
              );
            })}
          </nav>
          <span className="hidden text-xs text-white/50 sm:block">{email}</span>
          <button onClick={logout} className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white" aria-label="Sair">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
    </div>
  );
}
