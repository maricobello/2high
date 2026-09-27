/**
 * Fundo animado em loop (efeito de vídeo, feito em CSS/SVG): sobrevoo lento por
 * placas solares em perspectiva e pulsos de energia correndo pelas linhas de
 * transmissão. Sem arquivo de vídeo, nítido em qualquer tela; parado com
 * "reduzir movimento". Puramente decorativo.
 */
const LINES = [
  "M-50 120 C 300 60, 600 150, 1250 40",
  "M-50 170 C 320 110, 640 200, 1250 95",
  "M-50 230 C 280 190, 700 260, 1250 160",
];

export function EnergyBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* placas solares em perspectiva, deslizando em direção a quem vê */}
      <div className="absolute inset-x-[-20%] bottom-[-10%] h-[75%] [perspective:600px]">
        <div
          className="energy-grid absolute inset-0 origin-bottom [transform:rotateX(62deg)]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(var(--primary-rgb) / 0.45) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--primary-rgb) / 0.45) 1px, transparent 1px)",
            backgroundSize: "56px 34px",
            maskImage: "linear-gradient(to top, black 25%, transparent 95%)",
          }}
        />
      </div>
      {/* linhas de transmissão com pulsos de energia */}
      <svg viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {LINES.map((d, i) => (
          <g key={d}>
            <path d={d} fill="none" className="stroke-primary" strokeOpacity="0.3" strokeWidth="1.4" />
            <path d={d} fill="none" className="energy-pulse stroke-primary" strokeWidth="3" strokeLinecap="round" pathLength={1} style={{ animationDelay: `${i * 1.6}s` }} />
          </g>
        ))}
      </svg>
      {/* brilho que respira devagar */}
      <div className="energy-breathe absolute left-[70%] top-1/2 size-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(var(--primary-rgb)/0.4),transparent_65%)]" />
      {/* leitura: escurece atrás do texto */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgb(4_6_12/0.9)_0%,rgb(4_6_12/0.55)_40%,rgb(4_6_12/0.05)_100%)]" />
    </div>
  );
}
