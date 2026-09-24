import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function Logo({ className, dark = true }: { className?: string; dark?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", dark ? "text-white" : "text-foreground", className)}>
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
        <rect width="32" height="32" rx="9" fill="#3d5afe" />
        <path d="M18.5 5 9 18h6l-1.5 9L23 14h-6l1.5-9Z" fill="#fff" />
      </svg>
      <span className="text-[17px]">{brand.name}</span>
    </span>
  );
}
