const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Barras de consumo mensal (SVG leve, sem dependências). */
export function HistoryChart({ data, current }: { data: { month: string; kwh: number }[]; current?: number | null }) {
  if (data.length < 3) return null;
  const max = Math.max(...data.map((d) => d.kwh), current ?? 0) * 1.1;
  const avg = data.reduce((a, d) => a + d.kwh, 0) / data.length;
  const w = 100 / data.length;
  return (
    <figure>
      <div className="relative h-44 w-full">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label="Histórico de consumo mensal">
          <line x1="0" x2="100" y1={100 - (avg / max) * 100} y2={100 - (avg / max) * 100} stroke="#3d5afe" strokeWidth="0.4" strokeDasharray="1.5 1.5" vectorEffect="non-scaling-stroke" />
          {data.map((d, i) => {
            const h = (d.kwh / max) * 100;
            const last = i === data.length - 1;
            return (
              <rect key={d.month} x={i * w + w * 0.18} y={100 - h} width={w * 0.64} height={h} rx="0.8" fill={last ? "#3d5afe" : "#c9d2ff"}>
                <title>{`${d.month}: ${d.kwh.toLocaleString("pt-BR")} kWh`}</title>
              </rect>
            );
          })}
        </svg>
      </div>
      <div className="mt-2 flex">
        {data.map((d) => (
          <span key={d.month} className="flex-1 text-center text-[10px] text-muted">
            {MONTHS[Number(d.month.slice(5, 7)) - 1]}/{d.month.slice(2, 4)}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex items-center gap-2 text-xs text-muted">
        <span className="inline-block h-0 w-5 border-t border-dashed border-primary" /> média do período: {Math.round(avg).toLocaleString("pt-BR")} kWh
      </figcaption>
    </figure>
  );
}
