import { cn } from "@/lib/utils";

/** Magic UI — Border Beam: feixe de luz percorrendo a borda do card (CSS puro, sem JS). */
export function BorderBeam({
  className,
  size = 80,
  duration = 7,
  delay = 0,
  colorFrom = "#34d3f0",
  colorTo = "#3ee066",
  borderWidth = 1.5,
}: {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
}) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 rounded-[inherit] border-transparent [mask-clip:padding-box,border-box] [mask-composite:intersect] [mask-image:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]"
      style={{ borderWidth, borderStyle: "solid" }}
    >
      <div
        className={cn("border-beam absolute aspect-square bg-gradient-to-l from-[var(--from)] via-[var(--to)] to-transparent", className)}
        style={
          {
            width: size,
            offsetPath: `rect(0 auto auto 0 round ${size}px)`,
            animationDuration: `${duration}s`,
            animationDelay: `${-delay}s`,
            "--from": colorFrom,
            "--to": colorTo,
          } as React.CSSProperties
        }
      />
    </div>
  );
}
