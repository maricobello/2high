"use client";

import NumberFlow from "@number-flow/react";
import { useRef, useState } from "react";
import { gsap, prefersReducedMotion, useGSAP } from "@/components/motion/gsap";
import { cn } from "@/lib/utils";

/** Fatura ILUSTRATIVA (Grupo A4 · Verde). Valores fictícios; o total é calculado. */
const ROWS: { label: string; qty: string; value: number | null; flag?: string; law?: string }[] = [
  { label: "Consumo fora de ponta", qty: "38.420 kWh", value: 21_518.4 },
  { label: "Consumo na ponta", qty: "4.180 kWh", value: 9_614.0 },
  { label: "Leitura do ciclo", qty: "Estimada", value: null, flag: "4ª leitura estimada consecutiva", law: "REN ANEEL 1.000/2021" },
  { label: "Demanda contratada", qty: "300 kW", value: 7_260.0 },
  { label: "Demanda medida", qty: "212 kW", value: null, flag: "ICMS calculado sobre 300 kW, não sobre os 212 kW usados", law: "Súmula 391 · STJ" },
  { label: "Energia reativa excedente", qty: "2.940 kvarh", value: 1_176.0, flag: "Fator de potência médio 0,94 — acima do mínimo de 0,92", law: "REN ANEEL 1.000/2021" },
  { label: "ICMS (18%)", qty: "", value: 8_912.33 },
  { label: "PIS/COFINS", qty: "", value: 2_115.06 },
];
const TOTAL = ROWS.reduce((s, r) => s + (r.value ?? 0), 0);
const FLAGS = ROWS.filter((r) => r.flag).length;
const brl = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function AnnotatedInvoice() {
  const ref = useRef<HTMLDivElement>(null);
  const [found, setFound] = useState(0);

  useGSAP(
    () => {
      const root = ref.current;
      if (!root) return;
      const rows = root.querySelectorAll("[data-row]");
      const flags = root.querySelectorAll("[data-flag]");
      if (prefersReducedMotion()) {
        gsap.set([rows, flags], { opacity: 1 });
        setFound(FLAGS);
        return;
      }
      gsap.set(rows, { opacity: 0, y: 10 });
      gsap.set(flags, { opacity: 0, height: 0, marginTop: 0 });
      const tl = gsap.timeline({ scrollTrigger: { trigger: root, start: "top 72%", once: true } });
      tl.to(rows, { opacity: 1, y: 0, duration: 0.45, ease: "power2.out", stagger: 0.07 })
        .fromTo("[data-scan]", { top: "0%", opacity: 1 }, { top: "100%", duration: 1.4, ease: "power1.inOut" }, "-=0.2")
        .to("[data-scan]", { opacity: 0, duration: 0.2 });
      flags.forEach((flag, i) => {
        tl.to(flag, { opacity: 1, height: "auto", marginTop: 8, duration: 0.5, ease: "power3.out", onStart: () => setFound(i + 1) }, i === 0 ? "-=0.9" : "-=0.15");
        tl.to(flag.closest("[data-row]"), { backgroundColor: "rgba(255,200,61,0.16)", duration: 0.4 }, "<");
      });
    },
    { scope: ref },
  );

  return (
    <div ref={ref} className="relative">
      <div className="relative overflow-hidden rounded-2xl border border-line bg-white shadow-[0_30px_80px_-40px_rgba(20,18,10,0.35)]">
        {/* Cabeçalho da fatura */}
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-stone">Fatura de energia elétrica</p>
            <p className="mt-1 text-sm font-semibold">Indústria ilustrativa Ltda.</p>
          </div>
          <div className="text-right font-mono text-[11px] leading-relaxed text-stone">
            <p>UC 3001234-56 · Ref. 03/2026</p>
            <p>Grupo A4 · Tarifa Verde</p>
          </div>
        </div>

        {/* Itens */}
        <div className="relative px-2 py-2 sm:px-3">
          <span data-scan aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 -translate-y-1/2 bg-gradient-to-b from-transparent via-volt/35 to-transparent opacity-0" />
          <table className="w-full text-[13px] sm:text-sm">
            <thead>
              <tr className="text-left font-mono text-[10.5px] uppercase tracking-[0.12em] text-stone">
                <th className="px-3 py-2 font-normal">Descrição</th>
                <th className="hidden px-3 py-2 text-right font-normal sm:table-cell">Quant.</th>
                <th className="px-3 py-2 text-right font-normal">R$</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} data-row className="rounded-lg align-top transition-colors">
                  <td className="px-3 py-2.5">
                    <span className="font-medium">{r.label}</span>
                    <span className="ml-1.5 text-stone sm:hidden">{r.qty}</span>
                    {r.flag && (
                      <span data-flag className="block overflow-hidden">
                        <span className="flex items-start gap-2 text-[12px] leading-snug">
                          <span className="mt-[3px] inline-block size-2 shrink-0 rounded-full bg-attention" />
                          <span>
                            <span className="font-semibold text-foreground">{r.flag}</span>
                            <span className="ml-1.5 font-mono text-[10.5px] text-stone">{r.law}</span>
                          </span>
                        </span>
                      </span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-right tabular text-stone sm:table-cell">{r.qty}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular">{r.value === null ? "—" : brl(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-line bg-paper px-5 py-3.5 sm:px-6">
          <span className="text-sm font-semibold">Total a pagar</span>
          <span className="text-lg font-semibold tabular">R$ {brl(TOTAL)}</span>
        </div>
      </div>

      {/* Contador de pontos de revisão */}
      <div className="absolute -top-4 right-4 flex items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-white shadow-lg sm:-right-4">
        <span className={cn("size-1.5 rounded-full", found ? "bg-volt" : "bg-white/40")} />
        <NumberFlow value={found} /> {found === 1 ? "ponto de revisão" : "pontos de revisão"}
      </div>
      <p className="mt-3 text-right font-mono text-[10.5px] text-stone">Fatura ilustrativa · valores fictícios</p>
    </div>
  );
}
