import { A_POINTS, BOLT_POINTS } from "../brand";

/** Símbolo + "ΛFERI" (mesmas formas do site, sem depender de fonte). */
export const Logo: React.FC<{ height: number; color?: string }> = ({ height, color = "#ffffff" }) => (
  <div style={{ display: "flex", alignItems: "center", gap: height * 0.28, color }}>
    <svg viewBox="0 -2 100 97" style={{ height, width: "auto" }}>
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6cff8e" />
          <stop offset="1" stopColor="#1fbf4a" />
        </linearGradient>
        <mask id="logo-m">
          <rect x="-10" y="-10" width="120" height="120" fill="white" />
          <polygon points={BOLT_POINTS} fill="black" stroke="black" strokeWidth="6" strokeLinejoin="round" />
        </mask>
      </defs>
      <polygon points={A_POINTS} fill="currentColor" mask="url(#logo-m)" />
      <polygon points={BOLT_POINTS} fill="url(#logo-g)" />
    </svg>
    <svg viewBox="0 0 168 40" style={{ height: height * 0.6, width: "auto" }} fill="currentColor">
      <polygon points="0,40 14,0 22,0 36,40 28,40 18,11 8,40" />
      <path d="M44 0h30v7H52v9.5h23v7H52V40h-8z" />
      <path d="M82 0h30v7H90v9.5h24v7H90V33h22v7H82z" />
      <path d="M120 0h20.5a11.75 11.75 0 0 1 3.2 23.06L153 40h-9l-8.6-16H128v16h-8zm8 7v10h12.5a5 5 0 0 0 0-10z" />
      <rect x="160" width="8" height="40" />
    </svg>
  </div>
);
