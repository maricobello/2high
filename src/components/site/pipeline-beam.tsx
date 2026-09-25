"use client";

import { Bot, Building2, Cpu, FileText, Image as ImageIcon, MessageCircle, ScanLine, ShieldCheck, Zap } from "lucide-react";
import { forwardRef, useRef } from "react";
import { AnimatedBeam } from "@/components/magicui/animated-beam";
import { cn } from "@/lib/utils";

const Node = forwardRef<HTMLDivElement, { className?: string; children: React.ReactNode; label?: string }>(({ className, children, label }, ref) => (
  <div className="flex flex-col items-center gap-2">
    <div ref={ref} className={cn("z-10 flex size-14 items-center justify-center rounded-2xl border border-white/10 bg-ink-3 text-cyan shadow-[0_0_24px_-8px_rgba(52,211,240,0.6)]", className)}>
      {children}
    </div>
    {label && <span className="max-w-24 text-center text-[11px] font-medium leading-tight text-white/60">{label}</span>}
  </div>
));
Node.displayName = "Node";

/** Fluxo visual: fatura → leitura → motor de regras → Raio-X / especialista (Magic UI Animated Beam). */
export function PipelineBeam() {
  const container = useRef<HTMLDivElement>(null);
  const pdf = useRef<HTMLDivElement>(null);
  const photo = useRef<HTMLDivElement>(null);
  const dist = useRef<HTMLDivElement>(null);
  const engine = useRef<HTMLDivElement>(null);
  const raiox = useRef<HTMLDivElement>(null);
  const ai = useRef<HTMLDivElement>(null);
  const human = useRef<HTMLDivElement>(null);

  return (
    <div ref={container} className="relative mx-auto flex w-full max-w-3xl items-center justify-between gap-4 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-6 sm:p-10">
      <div className="flex flex-col gap-8">
        <Node ref={pdf} label="PDF da fatura">
          <FileText className="size-6" />
        </Node>
        <Node ref={photo} label="Foto pelo celular">
          <ImageIcon className="size-6" />
        </Node>
        <Node ref={dist} label="Dados da empresa">
          <Building2 className="size-6" />
        </Node>
      </div>
      <div className="flex flex-col items-center gap-3">
        <Node ref={engine} className="size-20 bg-primary text-primary-foreground shadow-[0_0_40px_-6px_rgba(62,224,102,0.9)]" label="Leitura + motor de regras">
          <Cpu className="size-9" />
        </Node>
        <div className="hidden gap-2 text-[10px] text-white/40 sm:flex">
          <span className="flex items-center gap-1">
            <ScanLine className="size-3" /> OCR
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck className="size-3" /> validação
          </span>
        </div>
      </div>
      <div className="flex flex-col gap-8">
        <Node ref={raiox} label="Raio-X da energia">
          <Zap className="size-6" />
        </Node>
        <Node ref={ai} label="Atendimento com IA">
          <Bot className="size-6" />
        </Node>
        <Node ref={human} label="Especialista no WhatsApp">
          <MessageCircle className="size-6" />
        </Node>
      </div>

      <AnimatedBeam containerRef={container} fromRef={pdf} toRef={engine} curvature={-50} duration={3.5} />
      <AnimatedBeam containerRef={container} fromRef={photo} toRef={engine} duration={3.5} delay={0.4} />
      <AnimatedBeam containerRef={container} fromRef={dist} toRef={engine} curvature={50} duration={3.5} delay={0.8} />
      <AnimatedBeam containerRef={container} fromRef={engine} toRef={raiox} curvature={-50} duration={3.5} delay={1.2} />
      <AnimatedBeam containerRef={container} fromRef={engine} toRef={ai} duration={3.5} delay={1.6} />
      <AnimatedBeam containerRef={container} fromRef={engine} toRef={human} curvature={50} duration={3.5} delay={2} />
    </div>
  );
}
