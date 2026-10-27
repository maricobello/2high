// Sorteio com semente (mulberry32): a mesma semente gera a mesma partida.
// O jogo inteiro sorteia por aqui; só os efeitos visuais usam Math.random.

export function createRng(seed = 1) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (a, b) => a + (b - a) * next(),
    int: (a, b) => a + Math.floor(next() * (b - a + 1)),
    chance: (p) => next() < p,
    pick: (list) => list[Math.floor(next() * list.length)],
    // weights: { chave: peso }; devolve uma chave (ou null se tudo for zero)
    weighted(weights) {
      let total = 0;
      for (const k in weights) total += Math.max(0, weights[k]);
      if (total <= 0) return null;
      let r = next() * total;
      for (const k in weights) {
        r -= Math.max(0, weights[k]);
        if (r < 0) return k;
      }
      return Object.keys(weights).at(-1);
    },
  };
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
