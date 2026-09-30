import { cn } from "@/lib/utils";

const MONTHS =["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Barras de consumo mensal (SVG leve, sem dependências; cores dos tokens). */
export function HistoryChart({ data }: { data: { month: string; kwh: number }[] }) {
  if (data.length < 3) return null;
  const max = Math.max(...data.map((d) => d.kwh)) * 1.1;
  const avg = data.reduce((a, d) => a + d.kwh, 0) / data.length;
  const w = 100 / data.length;
  const label = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(2, 4)}`;
  return (
    <figure className="@container">
      <div className="relative h-44 w-full sm:h-52">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" role="img" aria-label={`Consumo mensal de ${label(data[0].month)} a ${label(data[data.length - 1].month)}`}>
          {[25, 50, 75].map((y) => (
            <line key={y} x1="0" x2="100" y1={y} y2={y} className="stroke-border" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {data.map((d, i) => {
            const h = (d.kwh / max) * 100;
            const last = i === data.length - 1;
            return (
              <rect key={d.month} x={i * w + w * 0.2} y={100 - h} width={w * 0.6} height={h} rx="0.8" className={last ? "fill-volt" : "fill-primary"} fillOpacity={last ? 1 : 0.85}>
                <title>{`${label(d.month)}: ${d.kwh.toLocaleString("pt-BR")} kWh`}</title>
              </rect>
            );
          })}
          <line x1="0" x2="100" y1={100 - (avg / max) * 100} y2={100 - (avg / max) * 100} className="stroke-primary-text" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
      <div className="mt-2 flex">
        {data.map((d, i) => (
          // Com muitos meses, os rótulos alternados só aparecem quando o gráfico é largo o bastante (container query).
          <span key={d.month} className={cn("min-w-0 flex-1 text-center text-[10px] whitespace-nowrap text-muted", i % 2 && data.length > 8 ? "invisible @md:visible" : "")}>
            {label(d.month)}
          </span>
        ))}
      </div>
      <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-primary" /> consumo (kWh)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-sm bg-volt" /> mês da fatura
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0 w-4 border-t-2 border-dashed border-primary-text" /> média: {Math.round(avg).toLocaleString("pt-BR")} kWh
        </span>
      </figcaption>
    </figure>
  );
}
