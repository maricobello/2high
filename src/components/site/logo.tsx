import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

/** Marca: mostrador de medição (aferir = medir) com ponteiro em amarelo. */
export function Logo({ className, dark = true }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", dark ? "text-white" : "text-foreground", className)}>
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <rect width="24" height="24" rx="6" fill="currentColor" />
        <path d="M5.5 15.5a6.5 6.5 0 0 1 13 0" fill="none" stroke={dark ? "#0b0b0c" : "#f5f4ef"} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M12 15.5 15.8 10" stroke="#ffc83d" strokeWidth="1.9" strokeLinecap="round" />
        <circle cx="12" cy="15.5" r="1.5" fill="#ffc83d" />
      </svg>
      <span className="text-[17px] tracking-[-0.02em]">{brand.name}</span>
    </span>
  );
}
