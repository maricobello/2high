import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.appUrl),
  title: {
    default: `${brand.name} — Diagnóstico de energia para empresas`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Envie sua fatura e descubra oportunidades de redução de custos, possíveis inconsistências de faturamento e quais soluções de energia podem fazer sentido para sua empresa.",
  openGraph: {
    title: "Sua empresa sabe exatamente quanto deveria estar pagando pela energia?",
    description: "Análise preliminar gratuita da sua conta de energia: auditoria de fatura, GD por assinatura e Mercado Livre.",
    locale: "pt_BR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#060a13",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable} h-full`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
