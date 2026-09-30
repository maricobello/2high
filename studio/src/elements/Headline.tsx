import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../brand";

/**
 * Título com palavras surgindo uma a uma e a frase-chave em amarelo,
 * sublinhada à mão (como no topo do site).
 */
export const Headline: React.FC<{ title: string; highlight: string; size: number; delay?: number; align?: "left" | "center" }> = ({ title, highlight, size, delay = 0, align = "left" }) => {
  const frame = useCurrentFrame() - delay;
  const { fps } = useVideoConfig();
  const words = title.split(" ");
  const word = (i: number) => {
    const s = spring({ frame: frame - i * 4, fps, config: { damping: 18, stiffness: 140 } });
    return { opacity: s, transform: `translateY(${(1 - s) * size * 0.35}px)`, display: "inline-block", marginRight: size * 0.24 };
  };
  const hlStart = words.length * 4 + 6;
  const hl = spring({ frame: frame - hlStart, fps, config: { damping: 16 } });
  const underline = interpolate(frame, [hlStart + 10, hlStart + 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <h1 style={{ margin: 0, fontSize: size, lineHeight: 1.06, fontWeight: 700, letterSpacing: "-0.035em", textAlign: align, textWrap: "balance" }}>
      {words.map((w, i) => (
        <span key={i} style={word(i)}>
          {w}
        </span>
      ))}
      <br />
      <span style={{ position: "relative", display: "inline-block", whiteSpace: "nowrap", color: colors.volt, opacity: hl, transform: `translateY(${(1 - hl) * size * 0.35}px)` }}>
        {highlight}
        <svg viewBox="0 0 300 20" preserveAspectRatio="none" style={{ position: "absolute", left: "-2%", bottom: -size * 0.16, width: "104%", height: size * 0.22 }}>
          <path d="M4 14 C 70 4, 160 4, 296 10" fill="none" stroke={colors.volt} strokeWidth={5} strokeLinecap="round" pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - underline} />
        </svg>
      </span>
    </h1>
  );
};
