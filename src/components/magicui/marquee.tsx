import { cn } from "@/lib/utils";

/** Magic UI — Marquee (CSS puro). */
export function Marquee({ className, reverse, pauseOnHover = true, children, repeat = 4 }: { className?: string; reverse?: boolean; pauseOnHover?: boolean; children: React.ReactNode; repeat?: number }) {
  return (
    <div className={cn("group flex overflow-hidden p-2 [--duration:40s] [--gap:2.5rem] [gap:var(--gap)]", className)}>
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          aria-hidden={i > 0}
          className={cn("flex shrink-0 animate-marquee flex-row justify-around [gap:var(--gap)]", pauseOnHover && "group-hover:[animation-play-state:paused]", reverse && "[animation-direction:reverse]")}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
