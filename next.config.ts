import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // CSS do Tailwind embutido no HTML: elimina a requisição que bloqueia a renderização
  experimental: { inlineCss: true },
  // Foto do topo (gerada no Higgsfield): a Vercel baixa, otimiza (AVIF/WebP) e serve do próprio domínio
  images: {
    remotePatterns: [new URL("https://d8j0ntlcm91z4.cloudfront.net/user_300aA2A2UbIvp6ou5XtUmlVDLTR/**")],
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
