"use client";

import { ChevronDown, Info } from "lucide-react";
import { useState } from "react";
import { cn, formatBRL } from "@/lib/utils";
import type { Finding } from "@/modules/rules-engine/types";

const KIND = {
  attention: { label: "Ponto de atenção", dot: "bg-attention", chip: "bg-attention-soft text-attention", bar: "bg-attention" },
  analysis: { label: "Análise recomendada", dot: "bg-analysis", chip: "bg-analysis-soft text-analysis", bar: "bg-analysis" },
  opportunity: { label: "Oportunidade", dot: "bg-opportunity", chip: "bg-opportunity-soft text-opportunity", bar: "bg-opportunity" },
  info: { label: "Informação", dot: "bg-primary", chip: "bg-primary-soft text-primary", bar: "bg-primary" },
} as const;

const CONF = { alta: 3, média: 2, baixa: 1 } as const;

export function FindingCard({ finding, plainText }: { finding: Finding; plainText?: string }) {
  const [open, setOpen] = useState(false);
  const k = KIND[finding.kind];
  const level = CONF[finding.confidence];
  return (
    <article className="relative overflow-hidden rounded-2xl border border-border bg-white">
      <span className={cn("absolute inset-y-0 left-0 w-1", k.bar)} />
      <div className="p-5 pl-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", k.chip)}>
            <span className={cn("size-2 rounded-full", k.dot)} /> {k.label}
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-muted" title="Nível de confiança da análise">
            Confiança {finding.confidence}
            <span className="flex gap-0.5">
              {[1, 2, 3].map((i) => (
                <span key={i} className={cn("h-2.5 w-1.5 rounded-sm", i <= level ? "bg-foreground/70" : "bg-border")} />
              ))}
            </span>
          </span>
        </div>
        <h3 className="mt-3 text-[17px] font-semibold tracking-tight">{finding.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-foreground/75">{plainText || finding.explanation}</p>

        {finding.estimatedMonthlyImpact && finding.kind === "opportunity" && (
          <div className="mt-4 inline-flex items-baseline gap-2 rounded-xl bg-opportunity-soft px-3.5 py-2">
            <span className="text-xs font-medium text-opportunity">Potencial estimado</span>
            <span className="font-semibold tabular text-opportunity">
              {formatBRL(finding.estimatedMonthlyImpact.min, { cents: false })} – {formatBRL(finding.estimatedMonthlyImpact.max, { cents: false })}/mês
            </span>
          </div>
        )}

        {finding.dataUsed.length > 0 && (
          <div className="mt-4">
            <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-semibold text-primary">
              Dados utilizados <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <dl className="mt-3 grid gap-x-6 gap-y-2 rounded-xl bg-subtle/70 p-3.5 text-sm sm:grid-cols-2">
                {finding.dataUsed.map((d) => (
                  <div key={d.label} className="flex justify-between gap-3">
                    <dt className="text-muted">{d.label}</dt>
                    <dd className="font-medium tabular">{d.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
        <p className="mt-4 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
          <Info className="mt-px size-3 shrink-0" /> {finding.disclaimer}
        </p>
      </div>
    </article>
  );
}
