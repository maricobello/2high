import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-border bg-card shadow-[0_1px_2px_rgba(16,24,40,0.04)]", className)} {...props} />;
}

export function Badge({ className, tone = "neutral", ...props }: React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "primary" | "attention" | "analysis" | "opportunity" | "dark" }) {
  const tones = {
    neutral: "bg-subtle text-muted",
    primary: "bg-primary-soft text-primary",
    attention: "bg-attention-soft text-attention",
    analysis: "bg-analysis-soft text-analysis",
    opportunity: "bg-opportunity-soft text-opportunity",
    dark: "bg-white/10 text-white/80",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", tones[tone], className)} {...props} />;
}

export function Eyebrow({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-xs font-semibold uppercase tracking-[0.18em] text-primary", className)} {...props} />;
}
