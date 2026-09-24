import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.appUrl),
  title: {
    default: `${brand.name} — Recupere o que sua empresa pagou a mais de energia`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Diagnóstico gratuito em 30 segundos. Auditamos até 60 faturas, cuidamos da devolução e do crédito de ICMS — e você só paga se o dinheiro voltar.",
  openGraph: {
    title: "Quanto sua empresa está deixando na mesa na conta de luz?",
    description: "Diagnóstico gratuito em 30 segundos. Você só paga se o dinheiro voltar.",
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
