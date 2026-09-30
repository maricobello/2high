import { cn } from "@/lib/utils";

/**
 * Ilustrações próprias do setor elétrico (SVG em traço, cor dos tokens).
 * Leves, nítidas em qualquer tela e decorativas (aria-hidden).
 */

/** Fatura com lupa: auditoria. */
export function InvoiceScanIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M11 5h17l8 8v16" />
      <path d="M28 5v8h8" />
      <path d="M11 5v36h14" />
      <path d="M16 16h8M16 21h14M16 26h10" />
      <path d="m18.5 31.5 2.5-4 1.5 2.5 2-3.5" className="stroke-volt" />
      <circle cx="33" cy="35" r="6" />
      <path d="m37.5 39.5 5 5" />
    </svg>
  );
}

/** Torre de transmissão com seta de retorno: devolução. */
export function TowerReturnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="M17 44 22 8h4l5 36" />
      <path d="M12 14h24M14 20h20" />
      <path d="m19.5 26 9 6m0-6-9 6m-.8 6 10.6 0" />
      <path d="M12 14v3M36 14v3" />
      <path d="M40 26a9 9 0 0 1-6 8.5" className="stroke-volt" />
      <path d="m36.5 36.5-2.7-2 2.2-2.6" className="stroke-volt" />
    </svg>
  );
}

/** Medidor com ponteiro: gestão mensal. */
export function MeterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="7" y="7" width="34" height="34" rx="8" />
      <path d="M13 29a11 11 0 0 1 22 0" />
      <path d="M15.5 21.5 17 23M24 17.5V20M32.5 21.5 31 23" />
      <path d="m24 29 5-7" className="stroke-volt" />
      <circle cx="24" cy="29" r="1.6" fill="currentColor" />
      <path d="M17 35h14" />
    </svg>
  );
}

/** Linha de tendência subindo (tarifas em alta). */
export function Sparkline({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 40" fill="none" className={className} aria-hidden>
      <path d="M2 34 20 30l14 3 16-9 14 2 16-10 14 1 22-15" className="stroke-volt" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 34 20 30l14 3 16-9 14 2 16-10 14 1 22-15V40H2Z" className="fill-volt" opacity="0.1" />
      <circle cx="118" cy="6" r="3" className="fill-volt" />
    </svg>
  );
}

/** Faixa com torres e cabos (catenária) e pulsos de energia correndo. */
export function PowerLineDivider({ className }: { className?: string }) {
  const towers = [60, 420, 780, 1140];
  const tower = (x: number) =>
    `M${x - 14} 78 L${x - 4} 14 L${x + 4} 14 L${x + 14} 78 M${x - 18} 22 H${x + 18} M${x - 14} 32 H${x + 14} M${x - 9} 48 L${x + 11} 64 M${x + 9} 48 L${x - 11} 64`;
  const cables = (dy: number) =>
    towers
      .slice(0, -1)
      .map((x, i) => `M${x + 18} ${22 + dy} Q${(x + towers[i + 1]) / 2} ${52 + dy} ${towers[i + 1] - 18} ${22 + dy}`)
      .join(" ");
  return (
    <div aria-hidden className={cn("pointer-events-none relative h-20 w-full overflow-hidden", className)}>
      <svg viewBox="0 0 1200 80" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 h-full w-full">
        <path d={towers.map(tower).join(" ")} fill="none" className="stroke-foreground" strokeOpacity="0.16" strokeWidth="1.5" strokeLinejoin="round" />
        {[0, 10].map((dy) => (
          <g key={dy}>
            <path d={cables(dy)} fill="none" className="stroke-primary" strokeOpacity="0.28" strokeWidth="1.2" />
            <path d={cables(dy)} fill="none" className="energy-pulse stroke-primary" strokeWidth="2" strokeLinecap="round" pathLength={1} style={{ animationDelay: `${dy / 5}s` }} />
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Usina solar em traço: placas em perspectiva, sol e torre ao fundo. */
export function SolarArrayArt({ className }: { className?: string }) {
  const panel = (x: number, y: number) => {
    const w = 64;
    const h = 30;
    const sk = 16;
    const cells: string[] = [];
    for (let i = 1; i < 4; i++) cells.push(`M${x + (w * i) / 4} ${y} L${x + (w * i) / 4 - sk} ${y + h}`);
    cells.push(`M${x - sk / 2} ${y + h / 2} H${x + w - sk / 2}`);
    return (
      <g key={`${x}-${y}`}>
        <path d={`M${x} ${y} H${x + w} L${x + w - sk} ${y + h} H${x - sk} Z`} className="fill-primary stroke-primary-text" fillOpacity="0.12" strokeWidth="1.4" strokeLinejoin="round" />
        <path d={cells.join(" ")} className="stroke-primary-text" strokeOpacity="0.55" strokeWidth="0.9" />
        <path d={`M${x + w / 2 - sk / 2} ${y + h} V${y + h + 14}`} className="stroke-foreground" strokeOpacity="0.35" strokeWidth="1.4" />
      </g>
    );
  };
  return (
    <svg viewBox="0 0 320 210" fill="none" className={className} aria-hidden>
      {/* sol */}
      <circle cx="262" cy="46" r="16" className="fill-volt" fillOpacity="0.9" />
      <g className="stroke-volt" strokeWidth="1.6" strokeLinecap="round" opacity="0.7">
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return <path key={i} d={`M${262 + Math.cos(a) * 23} ${46 + Math.sin(a) * 23} L${262 + Math.cos(a) * 30} ${46 + Math.sin(a) * 30}`} />;
        })}
      </g>
      {/* torre e cabos ao fundo */}
      <path d="M38 150 46 70h6l8 80M30 82h38M34 94h30M41 112l16 14m0-14-16 14" className="stroke-foreground" strokeOpacity="0.28" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M68 82 Q140 110 214 96" className="stroke-foreground" strokeOpacity="0.2" strokeWidth="1.2" />
      <path d="M68 82 Q140 110 214 96" className="energy-pulse stroke-primary" strokeWidth="2" strokeLinecap="round" pathLength={1} />
      {/* chão */}
      <path d="M8 196 H312" className="stroke-foreground" strokeOpacity="0.15" strokeWidth="1.2" />
      {/* placas */}
      {panel(110, 112)}
      {panel(190, 112)}
      {panel(96, 150)}
      {panel(176, 150)}
      {panel(256, 150)}
    </svg>
  );
}
