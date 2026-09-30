import { interpolate, useCurrentFrame } from "remotion";
import { colors } from "../brand";

const PATH = "M0 62 C 120 20, 220 92, 360 52 S 600 8, 760 58 S 930 86, 1000 36";

/** Linha de energia que se desenha e um pulso amarelo que corre por ela. */
export const EnergyLine: React.FC<{ top: number | string; height: number; delay?: number; drawFrames?: number }> = ({ top, height, delay = 0, drawFrames = 40 }) => {
  const frame = useCurrentFrame() - delay;
  const drawn = interpolate(frame, [0, drawFrames], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const pulse = (frame / 70) % 1.2;
  return (
    <svg viewBox="0 0 1000 100" preserveAspectRatio="none" style={{ position: "absolute", left: 0, top, width: "100%", height }}>
      <path d={PATH} fill="none" stroke={colors.primary} strokeOpacity={0.55} strokeWidth={2} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - drawn} vectorEffect="non-scaling-stroke" />
      {drawn >= 1 && (
        <path
          d={PATH}
          fill="none"
          stroke={colors.volt}
          strokeWidth={4}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray="0.07 1.2"
          strokeDashoffset={-pulse + 0.07}
          vectorEffect="non-scaling-stroke"
          style={{ filter: `drop-shadow(0 0 8px ${colors.volt})` }}
        />
      )}
    </svg>
  );
};
