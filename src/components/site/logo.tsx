import { useId } from "react";
import { cn } from "@/lib/utils";

/** Pontos do raio (mesma geometria no símbolo, no favicon e na imagem de compartilhamento). */
export const BOLT_POINTS = "57,32 79,37 62,49 71,51 27,93 45,60 36,58";
export const A_POINTS = "0,68 37,0 63,0 100,68 77,68 50,19 23,68";

/** Símbolo: "A" em chevron com raio verde atravessando. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 -2 100 97" className={className} aria-hidden>
      <defs>
        <linearGradient id={`${id}-g`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#6cff8e" />
          <stop offset="1" stopColor="#1fbf4a" />
        </linearGradient>
        <linearGradient id={`${id}-w`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d9dedb" />
        </linearGradient>
        {/* recorta o "A" em volta do raio, qualquer que seja o fundo */}
        <mask id={`${id}-m`}>
          <rect x="-10" y="-10" width="120" height="120" fill="white" />
          <polygon points={BOLT_POINTS} fill="black" stroke="black" strokeWidth="6" strokeLinejoin="round" />
        </mask>
      </defs>
      <polygon points={A_POINTS} fill={`url(#${id}-w)`} mask={`url(#${id}-m)`} />
      <polygon points={BOLT_POINTS} fill={`url(#${id}-g)`} />
    </svg>
  );
}

/** Logotipo "ΛFERI" desenhado em formas (sem depender de fonte). */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 168 40" className={className} fill="currentColor" aria-hidden>
      <polygon points="0,40 14,0 22,0 36,40 28,40 18,11 8,40" />
      <path d="M44 0h30v7H52v9.5h23v7H52V40h-8z" />
      <path d="M82 0h30v7H90v9.5h24v7H90V33h22v7H82z" />
      <path d="M120 0h20.5a11.75 11.75 0 0 1 3.2 23.06L153 40h-9l-8.6-16H128v16h-8zm8 7v10h12.5a5 5 0 0 0 0-10z" />
      <rect x="160" width="8" height="40" />
    </svg>
  );
}

export function Logo({ className, dark = true, tagline = true }: { className?: string; dark?: boolean; tagline?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", dark ? "text-white" : "text-foreground", className)}>
      <LogoMark className="h-9 w-auto shrink-0" />
      <span className="flex flex-col items-start gap-[5px]">
        <Wordmark className="h-[22px] w-auto" />
        {tagline && (
          <svg viewBox="0 0 168 7" className="h-[5.5px] w-auto opacity-80" aria-hidden>
            <text x="0" y="6.2" textLength="168" lengthAdjust="spacing" fill="currentColor" fontSize="7.4" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fontWeight="500">
              GESTÃO INTELIGENTE DE ENERGIA
            </text>
          </svg>
        )}
      </span>
    </span>
  );
}
