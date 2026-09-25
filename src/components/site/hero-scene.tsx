import Image from "next/image";

/** Foto do topo: usina solar e linha de transmissão ao pôr do sol (gerada no Higgsfield). */
export const HERO_PHOTO = "https://d8j0ntlcm91z4.cloudfront.net/user_300aA2A2UbIvp6ou5XtUmlVDLTR/hf_20260925_145352_bfe9e274-0a38-452e-884f-1b247bee1f34.png";

/**
 * Cenário do topo: foto de fundo sobre um cenário em SVG (reserva se a foto não carregar),
 * escurecida à esquerda para leitura, com a linha verde animada da marca.
 */
function Tower({ x, base, h }: { x: number; base: number; h: number }) {
  const w = h * 0.34; // abertura da base
  const top = base - h;
  const neck = h * 0.12;
  const lines: string[] = [];
  // pernas
  lines.push(`M${x - w / 2} ${base} L${x - neck / 2} ${top + h * 0.28} L${x - neck / 2} ${top}`);
  lines.push(`M${x + w / 2} ${base} L${x + neck / 2} ${top + h * 0.28} L${x + neck / 2} ${top}`);
  // treliça em X
  const steps = 6;
  for (let i = 0; i < steps; i++) {
    const y1 = base - (i * h * 0.72) / steps;
    const y2 = base - ((i + 1) * h * 0.72) / steps;
    const half = (y: number) => neck / 2 + ((w - neck) / 2) * ((y - (top + h * 0.28)) / (base - (top + h * 0.28)));
    lines.push(`M${x - half(y1)} ${y1} L${x + half(y2)} ${y2} M${x + half(y1)} ${y1} L${x - half(y2)} ${y2} M${x - half(y2)} ${y2} L${x + half(y2)} ${y2}`);
  }
  // braços
  const arm = h * 0.3;
  for (const f of [0.06, 0.2]) lines.push(`M${x - arm} ${top + h * f} L${x + arm} ${top + h * f} M${x - arm} ${top + h * f} L${x} ${top + h * (f + 0.08)} L${x + arm} ${top + h * f}`);
  return <path d={lines.join(" ")} />;
}

export function HeroScene() {
  // placas solares: linhas convergindo para o ponto de fuga
  const vx = 1180;
  const vy = 600;
  const rows = [640, 660, 686, 720, 766, 826, 900];
  const cols = Array.from({ length: 15 }, (_, i) => 640 + i * 70);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id="hs-sun" cx="1480" cy="600" r="520" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ffd37a" stopOpacity="0.95" />
            <stop offset="0.08" stopColor="#f59e3b" stopOpacity="0.6" />
            <stop offset="0.35" stopColor="#7a4a1c" stopOpacity="0.25" />
            <stop offset="1" stopColor="#030605" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="hs-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0e1c24" />
            <stop offset="1" stopColor="#050c0a" />
          </linearGradient>
          <linearGradient id="hs-fade" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0.35" stopColor="#030605" />
            <stop offset="0.62" stopColor="#030605" stopOpacity="0.2" />
            <stop offset="1" stopColor="#030605" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* céu e sol */}
        <rect width="1600" height="900" fill="url(#hs-sun)" />
        <circle cx="1480" cy="600" r="16" fill="#fff4d6" />
        {/* montanhas */}
        <path d="M700 620 L820 590 L900 604 L1010 572 L1120 598 L1230 566 L1340 596 L1460 578 L1600 600 L1600 660 L700 660 Z" fill="#07100d" />
        <path d="M900 632 L1040 606 L1160 624 L1300 600 L1440 620 L1600 610 L1600 670 L900 670 Z" fill="#050b09" />

        {/* torres e cabos */}
        <g stroke="#0a0f0c" strokeWidth="2.2" fill="none">
          <Tower x={1330} base={640} h={300} />
          <Tower x={1110} base={630} h={150} />
          <Tower x={960} base={626} h={80} />
        </g>
        <g stroke="#0a0f0c" strokeWidth="1.2" fill="none" opacity="0.9">
          <path d="M1600 380 Q1460 420 1330 358 Q1220 410 1110 492 Q1030 530 960 552" />
          <path d="M1600 420 Q1460 470 1330 400 Q1220 450 1110 520 Q1030 555 960 570" />
        </g>

        {/* placas solares */}
        <polygon points="560,900 1600,900 1600,640 820,640" fill="url(#hs-field)" />
        <g stroke="#2a4a57" strokeOpacity="0.55" strokeWidth="1.2">
          {rows.map((y) => (
            <line key={y} x1={820 - ((y - 640) / 260) * 260} y1={y} x2="1600" y2={y} />
          ))}
          {cols.map((x) => {
            const t = (900 - vy) / (640 - vy);
            return <line key={x} x1={vx + (x - vx) / t} y1="640" x2={x - 60} y2="900" />;
          })}
        </g>
        {/* brilho do sol refletido nas placas */}
        <ellipse cx="1380" cy="700" rx="240" ry="50" fill="#f59e3b" opacity="0.12" />
        <line x1="820" y1="640" x2="560" y2="900" stroke="#3ee066" strokeWidth="8" opacity="0.15" />
        <line x1="820" y1="640" x2="560" y2="900" stroke="#3ee066" strokeWidth="2" opacity="0.85" />


        {/* traços verdes da marca */}
        <g stroke="#3ee066" fill="none">
          <path d="M-40 640 L260 940" strokeWidth="7" opacity="0.12" />
          <path d="M-40 640 L260 940" strokeWidth="1.6" opacity="0.7" />
          <path d="M-40 720 L180 940" strokeWidth="1" opacity="0.4" />
        </g>
      </svg>
      <Image src={HERO_PHOTO} alt="" fill sizes="100vw" quality={70} className="object-cover object-[70%_center]" />
      {/* leitura à esquerda e transição para a faixa de baixo */}
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(3,6,5,0.95)_0%,rgba(3,6,5,0.8)_28%,rgba(3,6,5,0.3)_52%,rgba(3,6,5,0)_75%)] max-lg:bg-[linear-gradient(180deg,rgba(3,6,5,0.85)_0%,rgba(3,6,5,0.55)_45%,rgba(3,6,5,0.75)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" />
      {/* linha verde animada (curva de energia) */}
      <svg viewBox="0 0 1600 900" preserveAspectRatio="xMaxYMid slice" className="absolute inset-0 h-full w-full">
        <path d="M-40 860 C 420 820, 700 640, 980 470 S 1420 150, 1680 60" fill="none" stroke="#3ee066" strokeOpacity="0.18" strokeWidth="1.5" />
        <path d="M-40 860 C 420 820, 700 640, 980 470 S 1420 150, 1680 60" fill="none" stroke="#3ee066" strokeWidth="2.5" strokeLinecap="round" pathLength={1} className="energy-line" />
      </svg>
      {/* brilho verde suave atrás do quiz */}
      <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_78%_40%,rgba(62,224,102,0.10),transparent_70%)]" />
    </div>
  );
}
