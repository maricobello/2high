"use client";

import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Demonstração animada (exemplo ilustrativo): a fatura é "escaneada", campos são
 * destacados em sequência e os achados aparecem em stagger — mostra o valor do
 * produto em segundos (show, don't tell).
 */
const LINES = [
  { label: "Distribuidora", value: "Cemig", hl: false },
  { label: "Subgrupo / Modalidade", value: "A4 · Verde", hl: false },
  { label: "Consumo total", value: "57.120 kWh", hl: false },
  { label: "Demanda contratada", value: "300 kW", hl: true },
  { label: "Demanda medida", value: "342 kW", hl: true },
  { label: "Fator de potência", value: "0,87", hl: true },
  { label: "Bandeira", value: "Amarela", hl: false },
  { label: "Total a pagar", value: "R$ 48.732,18", hl: false },
];

const FINDINGS = [
  { tone: "bg-attention", chip: "text-attention", label: "Ponto de atenção", title: "Possível ultrapassagem de demanda", at: 4 },
  { tone: "bg-attention", chip: "text-attention", label: "Ponto de atenção", title: "Indicador de energia reativa", at: 5 },
  { tone: "bg-analysis", chip: "text-analysis", label: "Análise recomendada", title: "Revisão da estrutura tarifária", at: 6 },
  { tone: "bg-opportunity", chip: "text-opportunity", label: "Oportunidade", title: "Perfil para avaliar o Mercado Livre", at: 8 },
];

export function ScanDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-80px" });
  const reduce = useReducedMotion();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const id = setInterval(() => setTick((t) => (t >= 12 ? 0 : t + 1)), 700);
    return () => clearInterval(id);
  }, [inView, reduce]);

  const k = reduce ? 12 : tick;

  return (
    <div ref={ref} className="grid gap-6 lg:grid-cols-[1fr_1fr] lg:items-center">
      {/* Fatura */}
      <div className="relative mx-auto w-full max-w-md rotate-[-1.5deg] rounded-2xl bg-white p-5 text-foreground shadow-[0_40px_80px_-30px_rgba(0,0,0,0.9)]">
        <div className="mb-4 flex items-center justify-between border-b border-dashed border-border pb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Conta de energia</p>
            <p className="text-sm font-semibold">Metalúrgica Exemplo Ltda</p>
          </div>
          <span className="rounded-md bg-subtle px-2 py-0.5 font-mono text-[10px] text-muted">SET/2026</span>
        </div>
        <ul className="space-y-1.5">
          {LINES.map((l, i) => {
            const active = k > i;
            return (
              <li
                key={l.label}
                className={cn(
                  "flex items-center justify-between rounded-md px-2 py-1 text-[13px] transition-colors duration-300",
                  active && l.hl ? "bg-volt/30 font-semibold" : active ? "bg-primary-soft/60" : "",
                )}
              >
                <span className="text-muted">{l.label}</span>
                <span className="font-mono tabular">{l.value}</span>
              </li>
            );
          })}
        </ul>
        {/* Linha de varredura */}
        {!reduce && inView && (
          <div className="pointer-events-none absolute inset-x-0 h-10 bg-gradient-to-b from-transparent via-cyan/35 to-transparent" style={{ animation: "scan-y 5.6s linear infinite", top: 0 }} />
        )}
        <span className="absolute -right-2 -top-3 rounded-full bg-ink px-2.5 py-1 text-[10px] font-semibold text-white shadow-lg">Exemplo ilustrativo</span>
      </div>

      {/* Achados */}
      <div className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-cyan">{k < 9 ? "Analisando a fatura…" : "Raio-X pronto"}</p>
        <AnimatePresence>
          {FINDINGS.filter((f) => k >= f.at).map((f) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 24 }}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3.5 backdrop-blur"
            >
              <span className={cn("size-3 shrink-0 rounded-full", f.tone)} />
              <div>
                <p className={cn("text-[10px] font-bold uppercase tracking-wider", f.chip, "brightness-150")}>{f.label}</p>
                <p className="font-semibold text-white">{f.title}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {k >= 9 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-volt/40 bg-volt/10 px-4 py-3 text-sm text-white">
            Potencial estimado para avaliar: <strong className="text-volt">R$ 2.924 – R$ 7.310/mês</strong>
            <span className="block text-[11px] text-white/70">Estimativa preliminar, sujeita à validação técnica.</span>
          </motion.div>
        )}
      </div>
    </div>
  );
}
