/**
 * Headline do hero com text reveal palavra a palavra (CSS, sem JS: não atrasa o LCP)
 * e sublinhado desenhado (SVG stroke-dashoffset) na palavra-chave.
 */
const WORDS = ["Sua", "empresa", "pode", "estar", "pagando", "energia", "a mais."];
const KEY = "a mais.";

export function HeroHeadline() {
  return (
    <h1 className="text-[33px] font-bold leading-[1.06] tracking-[-0.035em] text-white sm:text-[52px] lg:text-[64px]">
      {WORDS.map((w, i) => (
        <span key={i} className="word-in" style={{ animationDelay: `${0.06 * i}s` }}>
          {w === KEY ? (
            <span className="relative inline-block text-volt">
              {w}
              <svg aria-hidden viewBox="0 0 200 18" preserveAspectRatio="none" className="absolute -bottom-2 left-0 h-3 w-full sm:-bottom-3 sm:h-4">
                <path d="M3 13 C 55 3, 120 3, 197 11" pathLength={1} className="draw-line" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              </svg>
            </span>
          ) : (
            w
          )}
          {i < WORDS.length - 1 && " "}
        </span>
      ))}
    </h1>
  );
}
