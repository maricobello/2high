import { cn } from "@/lib/utils";

/** Magic UI — Animated Shiny Text. */
export function AnimatedShinyText({ children, className, shimmerWidth = 120 }: { children: React.ReactNode; className?: string; shimmerWidth?: number }) {
  return (
    <span
      style={{ "--shiny-width": `${shimmerWidth}px` } as React.CSSProperties}
      className={cn(
        "animate-shiny-text bg-clip-text bg-no-repeat [background-position:0_0] [background-size:var(--shiny-width)_100%] [transition:background-position_1s_cubic-bezier(.6,.6,0,1)_infinite]",
        "bg-gradient-to-r from-transparent via-white/90 via-50% to-transparent text-white/70",
        className,
      )}
    >
      {children}
    </span>
  );
}
