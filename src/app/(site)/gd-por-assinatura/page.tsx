import { pageMetadata } from "@/lib/seo";
import { Building2, FileCheck2, PlugZap, Sun } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { GdSimulator } from "@/components/forms/gd-simulator";
import { Badge } from "@/components/ui/card";

export const metadata: Metadata = pageMetadata({
  path: "/gd-por-assinatura",
  title: "Energia solar sem instalar painéis",
  description: "Simule a economia estimada com geração distribuída por assinatura para sua empresa.",
});

export default function GdPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink pb-28 pt-12 text-white">
        <div className="glow absolute inset-0" />
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Badge tone="dark" className="border border-white/10">GD por assinatura</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">ENERGIA SOLAR SEM INSTALAR PAINÉIS</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            Reduza o custo da sua energia utilizando geração compartilhada, quando disponível e aplicável ao seu perfil.
          </p>
          <div className="mt-8 grid max-w-3xl gap-4 text-sm text-white/75 sm:grid-cols-3">
            {[
              { icon: Sun, t: "Usinas remotas geram a energia" },
              { icon: PlugZap, t: "Créditos compensados na sua conta" },
              { icon: Building2, t: "Sem obra, sem equipamento" },
            ].map(({ icon: Icon, t }) => (
              <div key={t} className="flex items-center gap-2.5">
                <Icon className="size-4 text-cyan" /> {t}
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="relative mx-auto -mt-16 max-w-6xl px-4 pb-16 sm:px-6">
        <GdSimulator />
      </section>
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="grid gap-6 rounded-3xl border border-border bg-card p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
          <div className="flex gap-4">
            <FileCheck2 className="mt-1 size-6 shrink-0 text-primary" />
            <div>
              <p className="font-semibold">Quer uma estimativa mais precisa?</p>
              <p className="mt-1 text-sm text-muted">Com a fatura, consideramos consumo real, custo de disponibilidade, iluminação pública e créditos existentes.</p>
            </div>
          </div>
          <Link href="/#analisar" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover">
            ENVIAR FATURA
          </Link>
        </div>
      </section>
    </>
  );
}
