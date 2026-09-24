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
    "Auditoria técnica de até 60 faturas de energia. Identificamos cobranças indevidas e conduzimos a restituição e o crédito de ICMS. Honorários apenas sobre o valor recuperado.",
  openGraph: {
    title: "Recupere o que sua empresa pagou a mais em energia.",
    description: "Auditoria técnica de faturas de energia. Honorários apenas sobre o valor recuperado.",
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
