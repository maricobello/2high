/**
 * Headline do hero com text reveal palavra a palavra (CSS, sem JS: não atrasa o LCP)
 * e sublinhado desenhado (SVG stroke-dashoffset) na palavra-chave.
 */
/* Pergunta de autoavaliação: o leitor responde "não" por dentro e o quiz ao lado vira a resposta. */
const WORDS = ["Sua", "empresa", "paga", "energia", "todo", "mês.", "Alguém confere?"];
const KEY = "Alguém confere?";

export function HeroHeadline() {
  return (
    <h1 className="text-balance text-[33px] font-bold leading-[1.06] tracking-[-0.035em] text-white sm:text-[52px] lg:text-[60px]">
      {WORDS.map((w, i) => (
        // a pergunta-chave ocupa a própria linha (display: block), sem linha vazia antes
        <span key={i} className="word-in" style={{ animationDelay: `${0.06 * i}s`, ...(w === KEY ? { display: "block", width: "fit-content" } : null) }}>
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
