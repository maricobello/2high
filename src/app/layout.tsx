import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { brand } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(brand.appUrl),
  title: {
    default: `${brand.name} — Auditoria gratuita da conta de energia`,
    template: `%s · ${brand.name}`,
  },
  description:
    "Sua empresa pode estar pagando energia a mais. Auditoria gratuita da fatura em 1 minuto e pedido de devolução de até 60 faturas, direto com a distribuidora.",
  openGraph: {
    title: "Sua empresa pode estar pagando energia a mais.",
    description: "Auditoria gratuita da conta de energia. Se houver cobrança indevida, buscamos a devolução de até 60 faturas.",
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
