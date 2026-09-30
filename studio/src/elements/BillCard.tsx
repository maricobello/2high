import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../brand";

export type BillItem = { label: string; status: "ok" | "revisar" };

const STATUS = {
  ok: { text: "Conferido", color: colors.opportunity, icon: "M5 12.5l4.5 4.5L19 7.5" },
  revisar: { text: "Revisar", color: colors.attention, icon: "M12 6v8M12 18.5v.01" },
} as const;

/**
 * Conta de energia ilustrativa sendo conferida linha a linha.
 * Sempre marcada como exemplo fictício.
 */
export const BillCard: React.FC<{ title: string; items: BillItem[]; width: number; scale?: number; delay?: number; step?: number }> = ({ title, items, width, scale, delay = 0, step = 34 }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  // escala do texto e espaçamentos (padrão: proporcional à largura)
  const u = scale ?? width / 640;
  const enter = spring({ frame, fps, config: { damping: 20 } });
  const scanned = Math.min(items.length, Math.max(0, Math.floor((frame - 18) / step) + 1));
  const toReview = items.slice(0, scanned).filter((i) => i.status === "revisar").length;
  return (
    <div
      style={{
        width,
        padding: 36 * u,
        borderRadius: 28 * u,
        background: `${colors.card}f2`,
        border: `${2 * u}px solid ${colors.primary}66`,
        boxShadow: `0 ${30 * u}px ${80 * u}px -${20 * u}px ${colors.primary}55`,
        opacity: enter,
        transform: `translateY(${(1 - enter) * 60 * u}px) scale(${0.96 + enter * 0.04})`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 30 * u, fontWeight: 700 }}>{title}</span>
        <span style={{ fontSize: 17 * u, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: colors.muted, border: `${1.5 * u}px solid ${colors.border}`, borderRadius: 99, padding: `${6 * u}px ${14 * u}px` }}>
          Exemplo fictício
        </span>
      </div>
      <div style={{ marginTop: 24 * u }}>
        {items.map((item, i) => {
          const local = frame - 18 - i * step;
          const scan = interpolate(local, [0, step * 0.7], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const done = spring({ frame: local - step * 0.7, fps, config: { damping: 14 } });
          const s = STATUS[item.status];
          return (
            <div key={item.label} style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between", padding: `${20 * u}px 0`, borderTop: i ? `${1.5 * u}px solid ${colors.border}` : "none" }}>
              {/* feixe de leitura passando pela linha */}
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${scan * 100}%`, background: `linear-gradient(90deg, transparent, ${colors.primary}22)`, opacity: scan < 1 ? 1 : 0 }} />
              <span style={{ fontSize: 27 * u, color: local > 0 ? colors.foreground : colors.muted }}>{item.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 * u, fontSize: 21 * u, fontWeight: 600, color: s.color, opacity: done, transform: `scale(${0.8 + done * 0.2})` }}>
                <svg viewBox="0 0 24 24" style={{ width: 30 * u, height: 30 * u }}>
                  <circle cx="12" cy="12" r="11" fill={`${s.color}22`} stroke={s.color} strokeWidth="1.5" />
                  <path d={s.icon} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {s.text}
              </span>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 18 * u, paddingTop: 22 * u, borderTop: `${1.5 * u}px dashed ${colors.border}`, display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 24 * u, color: colors.muted }}>Pontos para revisar</span>
        <span style={{ fontSize: 48 * u, fontWeight: 700, color: toReview ? colors.volt : colors.foreground, fontVariantNumeric: "tabular-nums" }}>{toReview}</span>
      </div>
    </div>
  );
};
