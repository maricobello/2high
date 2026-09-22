import type { Metadata } from "next";
import { FreeMarketSimulator } from "@/components/forms/free-market-simulator";
import { Badge } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Mercado Livre de Energia",
  description: "Análise preliminar de perfil para o Mercado Livre de Energia.",
};

export default function FreeMarketPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-ink pb-28 pt-12 text-white">
        <div className="glow absolute inset-0" />
        <div className="grid-bg absolute inset-0" />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
          <Badge tone="dark" className="border border-white/10">Mercado Livre de Energia</Badge>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            DESCUBRA SE SUA EMPRESA PODE SE BENEFICIAR DO MERCADO LIVRE
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-white/70">
            No ambiente livre, a empresa negocia preço e prazo da energia diretamente com comercializadoras. Informe os dados da unidade e receba uma análise preliminar
            de perfil.
          </p>
        </div>
      </section>
      <section className="relative mx-auto -mt-16 max-w-6xl px-4 pb-20 sm:px-6">
        <FreeMarketSimulator />
      </section>
    </>
  );
}
