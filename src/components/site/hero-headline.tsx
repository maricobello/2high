/**
 * Headline do hero com text reveal palavra a palavra (CSS, sem JS: não atrasa o LCP)
 * e a pergunta-chave em verde.
 */
/* Pergunta de autoavaliação: o leitor responde "não" por dentro e o quiz ao lado vira a resposta. */
const WORDS = ["Sua", "empresa", "paga", "energia", "todo", "mês.", "Alguém confere?"];
const KEY = "Alguém confere?";

export function HeroHeadline() {
  return (
    <h1 className="text-balance text-[33px] font-bold leading-[1.06] tracking-[-0.035em] text-white sm:text-[52px] lg:text-[64px]">
      {WORDS.map((w, i) => (
        // a pergunta-chave ocupa a própria linha (display: block), sem linha vazia antes
        <span key={i} className="word-in" style={{ animationDelay: `${0.06 * i}s`, ...(w === KEY ? { display: "block", width: "fit-content" } : null) }}>
          {w === KEY ? (
            <span className="text-primary">{w}</span>
          ) : (
            w
          )}
          {i < WORDS.length - 1 && " "}
        </span>
      ))}
    </h1>
  );
}
