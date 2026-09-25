import { ImageResponse } from "next/og";
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
          background: "radial-gradient(900px circle at 80% 0%, rgba(61,90,254,0.45), transparent 60%), #04060c",
          color: "white",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "#3d5afe", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>⚡</div>
          {brand.name}
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
          <span>Sua empresa paga energia todo mês.</span>
          <span style={{ color: "#ffc83d" }}>Alguém confere?</span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.75)" }}>Diagnóstico sem custo · Remuneração só sobre o valor recuperado</div>
      </div>
    ),
    size,
  );
}
