import type { Metadata } from "next";
import { brand } from "@/lib/brand";

/** Metadados de página pública: título, descrição, canonical e Open Graph coerentes. */
export function pageMetadata({ path, title, description, absoluteTitle = false }: { path: string; title: string; description: string; absoluteTitle?: boolean }): Metadata {
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: path, siteName: brand.name, locale: "pt_BR", type: "website" },
  };
}

/** JSON-LD seguro para <script> (escapa "<"). */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
