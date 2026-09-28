import { Mail } from "lucide-react";

/**
 * Exemplo fictício de resposta da distribuidora com devolução em dobro.
 * Mostra como o valor é calculado; não é caso de cliente nem depoimento.
 */
const ROWS = [
  { label: "Diferença apurada", value: "R$ 3.126,40" },
  { label: "Em dobro (CDC, art. 42)", value: "R$ 6.252,80" },
  { label: "Atualização financeira (IPCA)", value: "R$ 38,12" },
  { label: "Juros de mora", value: "R$ 61,55" },
];

export function RefundExample() {
  return (
    <figure className="relative mx-auto w-full max-w-md rotate-[1deg] rounded-2xl border border-border bg-card p-5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
      <span className="absolute -right-2 -top-3 rounded-full bg-volt px-2.5 py-1 text-[10px] font-bold text-ink shadow-lg">Exemplo fictício</span>
      <div className="flex items-center gap-3 border-b border-dashed border-border pb-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-text">
          <Mail className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Distribuidora de energia</p>
          <p className="text-[11px] text-muted">Resposta à reclamação de cobrança</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted">
        A distribuidora cancelou a cobrança e gerou o valor para devolução em dobro, que será depositado na conta informada, conforme segue:
      </p>
      <dl className="mt-3 space-y-1.5 font-mono text-[12.5px]">
        {ROWS.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted">{r.label}</dt>
            <dd className="tabular text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-baseline justify-between gap-3 rounded-xl bg-ink px-3 py-2.5">
        <span className="text-[13px] font-semibold text-white">Total a devolver</span>
        <span className="font-mono text-lg font-bold tabular text-volt">R$ 6.352,47</span>
      </div>
      <figcaption className="mt-3 text-[11px] leading-snug text-muted">Valores ilustrativos. Cada caso depende de análise da fatura e da resposta da distribuidora.</figcaption>
    </figure>
  );
}
