import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../brand";

/** Botão principal do site: pílula azul, texto branco em caixa-alta. */
export const CtaPill: React.FC<{ label: string; size: number; delay?: number }> = ({ label, size, delay = 0 }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14 } });
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: size * 0.5,
        padding: `${size * 0.85}px ${size * 1.6}px`,
        borderRadius: 999,
        background: colors.primary,
        color: colors.primaryForeground,
        fontSize: size,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        boxShadow: `0 0 ${size * 2}px -${size * 0.3}px ${colors.primary}`,
        opacity: s,
        transform: `scale(${0.85 + s * 0.15})`,
      }}
    >
      {label}
      <svg viewBox="0 0 24 24" style={{ width: size * 1.1, height: size * 1.1 }}>
        <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
};
