import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  // Prévias da Vercel não devem ser indexadas
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api", "/diagnostico", "/contato-indisponivel"] },
    sitemap: `${brand.appUrl}/sitemap.xml`,
  };
}
