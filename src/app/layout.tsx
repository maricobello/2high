import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.appUrl),
  title: {
    default: `${brand.name} — Auditoria e gestão de energia`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Auditoria e gestão de energia para empresas e condomínios. Auditamos suas últimas 60 faturas e pedimos a devolução de cobranças indevidas. Remuneração apenas sobre o valor recuperado.",
  openGraph: {
    title: "Sua empresa paga energia todo mês. Alguém confere?",
    description: "Auditoria e gestão de energia. Diagnóstico em cinco perguntas.",
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
