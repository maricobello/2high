import { AbsoluteFill } from "remotion";
import { colors, FONT } from "../brand";

/** Fundo escuro da marca: gradiente azul-marinho, brilho azul no canto e grade sutil. */
export const Background: React.FC<{ children?: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(90% 60% at 85% 0%, ${colors.primary}40 0%, transparent 60%), linear-gradient(180deg, ${colors.ink} 0%, ${colors.background} 100%)`,
      color: colors.foreground,
      fontFamily: FONT,
    }}
  >
    <AbsoluteFill
      style={{
        backgroundImage: `linear-gradient(${colors.border}66 1px, transparent 1px), linear-gradient(90deg, ${colors.border}66 1px, transparent 1px)`,
        backgroundSize: "72px 72px",
        maskImage: "radial-gradient(ellipse at 50% 40%, black 20%, transparent 70%)",
        opacity: 0.45,
      }}
    />
    {children}
  </AbsoluteFill>
);
