import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

const PAGES: { path: string; priority: number }[] = [
  { path: "", priority: 1 },
  { path: "/guia-conta-de-energia", priority: 0.7 },
  { path: "/gd-por-assinatura", priority: 0.6 },
  { path: "/mercado-livre", priority: 0.6 },
  { path: "/privacidade", priority: 0.2 },
  { path: "/termos", priority: 0.2 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PAGES.map((p) => ({ url: `${brand.appUrl}${p.path}`, lastModified: now, changeFrequency: "monthly", priority: p.priority }));
}
