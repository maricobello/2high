// Ferramentas para sprites em alta definição: cada unidade do mundo vale 2×2
// pixels do sprite. Sombra em 3 tons (luz em cima à esquerda), brilho de borda
// e pontilhado dão o volume que a pixel art de baixa resolução não comporta.
import { LIGHT, DARK, grid, inside, set, mirrorGrid, outline, toRows } from "./pixel.js";

// Grade para uma peça de w × h unidades do mundo.
export const hdGrid = (w, h) => grid(w * 2, h * 2);

const lighter = (c, n) => {
  for (let i = 0; i < n; i++) c = LIGHT[c] ?? c;
  return c;
};
const darker = (c, n) => {
  for (let i = 0; i < n; i++) c = DARK[c] ?? c;
  return c;
};

// Luz de cima à esquerda em 2 passos (a borda clareia 2 tons, a camada de
// dentro 1) e sombra embaixo à direita em 2 passos; o miolo fica na cor base.
export function shade3(G) {
  const src = G.map((r) => [...r]);
  const filled = (x, y) => inside(G, x, y) && src[y][x] !== ".";
  for (let y = 0; y < G.length; y++) {
    for (let x = 0; x < G[0].length; x++) {
      const c = src[y][x];
      if (c === ".") continue;
      if (!filled(x, y - 1) || !filled(x - 1, y)) G[y][x] = lighter(c, 2);
      else if (!filled(x, y + 1) || !filled(x + 1, y)) G[y][x] = darker(c, 2);
      else if (!filled(x, y - 2) || !filled(x - 2, y)) G[y][x] = lighter(c, 1);
      else if (!filled(x, y + 2) || !filled(x + 2, y)) G[y][x] = darker(c, 1);
    }
  }
}

// Brilho de 1 pixel no topo da metade esquerda da peça (onde a luz bate).
export function rim(G, ch = "w") {
  let minX = Infinity;
  let maxX = -Infinity;
  for (const row of G) {
    row.forEach((c, x) => {
      if (c !== ".") {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
    });
  }
  if (minX > maxX) return;
  const limit = minX + (maxX - minX) / 2;
  for (let x = minX; x <= limit; x++) {
    const y = G.findIndex((row) => row[x] !== ".");
    if (y >= 0) G[y][x] = ch;
  }
}

// Xadrez entre duas cores no retângulo (transição suave entre tons).
export function dither(G, x, y, w, h, a, b) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(G, i, j, (i + j) % 2 === 0 ? a : b);
}

// Acabamento das peças em alta definição: espelho, volume, brilho e contorno.
export function finishHD(G, { sym = true, rimColor = "w" } = {}) {
  if (sym) mirrorGrid(G);
  shade3(G);
  if (rimColor) rim(G, rimColor);
  outline(G);
  return toRows(G);
}
