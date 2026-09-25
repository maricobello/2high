import { ImageResponse } from "next/og";
import { A_POINTS, BOLT_POINTS } from "@/components/site/logo";
import { brand } from "@/lib/brand";

export const alt = `${brand.name} — auditoria e gestão de energia para empresas`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Imagem de compartilhamento (WhatsApp, LinkedIn): mesma identidade do topo do site. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(900px circle at 80% 0%, rgba(62,224,102,0.45), transparent 60%), #030605",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <svg width="84" height="80" viewBox="0 -2 100 97">
            <defs>
              <mask id="m">
                <rect x="-10" y="-10" width="120" height="120" fill="white" />
                <polygon points={BOLT_POINTS} fill="black" stroke="black" strokeWidth="6" strokeLinejoin="round" />
              </mask>
            </defs>
            <polygon points={A_POINTS} fill="#ffffff" mask="url(#m)" />
            <polygon points={BOLT_POINTS} fill="#3ee066" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 52, fontWeight: 700, letterSpacing: 10 }}>ΛFERI</div>
            <div style={{ fontSize: 15, letterSpacing: 6, color: "rgba(255,255,255,0.75)" }}>GESTÃO INTELIGENTE DE ENERGIA</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          <span>Sua empresa paga energia todo mês.</span>
          <span style={{ color: "#3ee066" }}>Alguém confere?</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.75)" }}>Diagnóstico sem custo · Remuneração só sobre o valor recuperado</div>
      </div>
    ),
    size,
  );
}
