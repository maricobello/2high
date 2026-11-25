"use client";

import { useEffect, useRef, useState } from "react";
import { compacto, kwh, MESES_CURTOS } from "./format";

const SERIES = [
  { key: "atual", label: "Rateio atual", color: "var(--viz-2)", dash: undefined },
  { key: "proposto", label: "Rateio proposto", color: "var(--viz-1)", dash: undefined },
  { key: "estresse", label: "Proposto com consumo menor", color: "var(--viz-3)", dash: "5 4" },
] as const;

/**
 * Saldo de créditos projetado mês a mês (uma escala, três cenários).
 * Cada série começa no saldo de hoje; `mesesDoAno` traz o mês (1-12) de cada ponto seguinte.
 */
export function SaldoChart({ atual, proposto, estresse, mesesDoAno, fatorEstresse }: { atual?: number[]; proposto: number[]; estresse: number[]; mesesDoAno: number[]; fatorEstresse: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const H = W < 520 ? 220 : 260;
  const pad = { l: 56, r: 16, t: 12, b: 30 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  const dados: Record<"atual" | "proposto" | "estresse", number[] | undefined> = { atual, proposto, estresse };
  const n = proposto.length;
  const max = Math.max(1, ...(atual ?? []), ...proposto, ...estresse) * 1.08;
  const x = (i: number) => pad.l + (n > 1 ? (i / (n - 1)) * iw : 0);
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const ticks = Array.from({ length: 5 }, (_, i) => (max / 4) * i);
  const rotulo = (i: number) => (i === 0 ? "hoje" : MESES_CURTOS[(mesesDoAno[i - 1] ?? 1) - 1]);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - r.left) / r.width) * iw;
    setHover(Math.max(0, Math.min(n - 1, Math.round((rel / iw) * (n - 1)))));
  }

  const series = SERIES.filter((s) => dados[s.key]);
  const legenda = series.map((s) => ({ ...s, label: s.key === "estresse" ? `Proposto com consumo ${Math.round((1 - fatorEstresse) * 100)}% menor` : s.label }));

  return (
    <figure className="m-0">
      <figcaption className="sr-only">Saldo de créditos projetado por mês nos cenários atual, proposto e de estresse.</figcaption>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
        {legenda.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            <svg width="22" height="8" aria-hidden>
              <line x1="1" x2="21" y1="4" y2="4" stroke={s.color} strokeWidth="2.5" strokeDasharray={s.dash} strokeLinecap="round" />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
      <div ref={box} className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full touch-none select-none" role="img" aria-label="Gráfico de saldo projetado">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {compacto(t)}
              </text>
            </g>
          ))}
          {proposto.map((_, i) => (
            <text key={i} x={x(i)} y={H - 10} textAnchor="middle" fontSize="11" fill="var(--muted)">
              {(n > 14 || W < 520) && i % 2 ? "" : rotulo(i)}
            </text>
          ))}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--muted)" strokeOpacity="0.5" strokeWidth="1" />}
          {series.map((s) => (
            <path key={s.key} d={path(dados[s.key]!)} fill="none" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {hover != null &&
            series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(dados[s.key]![hover])} r="4.5" fill={s.color} stroke="var(--card)" strokeWidth="2" />)}
          <rect x={pad.l} y={pad.t} width={iw} height={ih} fill="transparent" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)} />
        </svg>
        {hover != null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-border bg-ink/95 p-3 text-xs shadow-xl"
            style={{ left: `${Math.min(70, Math.max(0, (x(hover) / W) * 100 - (hover > n / 2 ? 34 : -4)))}%` }}
          >
            <p className="mb-1.5 font-semibold text-foreground">{hover === 0 ? "Hoje" : `Mês ${hover} (${rotulo(hover)})`}</p>
            {legenda.map((s) => (
              <p key={s.key} className="flex items-center justify-between gap-3 text-muted">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full" style={{ background: s.color }} />
                  {s.label.replace("Proposto com consumo", "Estresse:").replace("% menor", "%")}
                </span>
                <span className="font-mono text-foreground">{kwh(dados[s.key]![hover])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
