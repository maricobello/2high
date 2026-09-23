import { useId } from "react";
import { cn } from "@/lib/utils";

/** Magic UI — Dot Pattern (fundo SVG). */
export function DotPattern({ width = 18, height = 18, cr = 1, className }: { width?: number; height?: number; cr?: number; className?: string }) {
  const id = useId();
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full fill-white/[0.07]", className)}>
      <defs>
        <pattern id={id} width={width} height={height} patternUnits="userSpaceOnUse" patternContentUnits="userSpaceOnUse">
          <circle cx={width / 2} cy={height / 2} r={cr} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" strokeWidth={0} fill={`url(#${id})`} />
    </svg>
  );
}
