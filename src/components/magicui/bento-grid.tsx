import { cn } from "@/lib/utils";

/** Magic UI — Bento Grid. */
export function BentoGrid({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid w-full auto-rows-[15rem] grid-cols-1 gap-4 md:grid-cols-3", className)}>{children}</div>;
}

export function BentoCard({
  name,
  description,
  Icon,
  className,
  background,
}: {
  name: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
  className?: string;
  background?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "group relative flex flex-col justify-end overflow-hidden rounded-2xl border border-border bg-card",
        "shadow-[0_0_0_1px_rgba(0,0,0,.02),0_2px_4px_rgba(0,0,0,.04),0_12px_24px_rgba(0,0,0,.04)]",
        className,
      )}
    >
      <div className="absolute inset-0">{background}</div>
      <div className="pointer-events-none relative z-10 flex transform-gpu flex-col gap-1.5 p-6 transition-all duration-300 group-hover:-translate-y-1">
        <span className="mb-2 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary transition-all duration-300 group-hover:scale-90 group-hover:bg-primary group-hover:text-white">
          <Icon className="size-5" />
        </span>
        <h3 className="text-lg font-semibold tracking-tight">{name}</h3>
        <p className="max-w-lg text-sm leading-relaxed text-muted">{description}</p>
      </div>
      <div className="pointer-events-none absolute inset-0 transition-all duration-300 group-hover:bg-primary/[0.02]" />
    </div>
  );
}
