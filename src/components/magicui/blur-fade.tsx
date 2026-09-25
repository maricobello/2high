import { cn } from "@/lib/utils";

/**
 * Entrada suave ao rolar a página, só com CSS (scroll-driven animation):
 * não depende de JavaScript nem atrasa a primeira pintura. Em navegadores
 * sem suporte, ou com "reduzir movimento", o conteúdo aparece normalmente.
 */
export function BlurFade({ children, className }: { children: React.ReactNode; className?: string; delay?: number }) {
  return <div className={cn("reveal", className)}>{children}</div>;
}
