// Mini editor de pixels: grades de texto (um caractere por pixel), formas
// simples, espelho, sombra e contorno. Usado pela arte em sprites.js e
// pelas ferramentas de alta definição em pixel-hd.js.

export const LIGHT = { l: "w", g: "l", d: "g", n: "N", N: "b", b: "B", B: "C", c: "C", R: "r", P: "p", p: "q", V: "v", v: "u", U: "V", E: "e", e: "m", S: "a", a: "s", s: "z", Z: "S", O: "o", o: "y", y: "Y" };
export const DARK = { w: "l", l: "g", g: "d", d: "n", N: "n", B: "b", b: "N", C: "c", c: "b", r: "R", q: "p", p: "P", u: "v", v: "V", V: "U", m: "e", e: "E", z: "s", s: "a", a: "S", S: "Z", Y: "y", y: "o", o: "O" };

export const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill("."));
export const toRows = (G) => G.map((r) => r.join(""));
export const inside = (G, x, y) => y >= 0 && y < G.length && x >= 0 && x < G[0].length;

export function set(G, x, y, ch) {
  x = Math.round(x);
  y = Math.round(y);
  if (inside(G, x, y)) G[y][x] = ch;
}

export function rect(G, x, y, w, h, ch) {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(G, i, j, ch);
}

// Preenche o polígono pelos centros dos pixels.
export function poly(G, pts, ch) {
  const ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
    const cy = y + 0.5;
    const xs = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= cy && y2 > cy) || (y2 <= cy && y1 > cy)) xs.push(x1 + ((cy - y1) / (y2 - y1)) * (x2 - x1));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) set(G, x, y, ch);
    }
  }
}

export function ellipse(G, cx, cy, rx, ry, ch) {
  for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
      const dx = (x + 0.5 - cx) / rx;
      const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy <= 1) set(G, x, y, ch);
    }
  }
}

export function line(G, x0, y0, x1, y1, ch, width = 1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    if (width === 1) set(G, x, y, ch);
    else rect(G, Math.round(x - (width - 1) / 2), Math.round(y - (width - 1) / 2), width, width, ch);
  }
}

export function stamp(G, rows, x, y) {
  rows.forEach((r, j) => [...r].forEach((ch, i) => ch !== "." && set(G, x + i, y + j, ch)));
}

// Copia a metade esquerda para a direita (largura ímpar: coluna central é o eixo).
export function mirrorGrid(G) {
  const w = G[0].length;
  for (const row of G) for (let x = 0; x < Math.floor(w / 2); x++) row[w - 1 - x] = row[x];
}

// Luz de cima: borda de cima clareia, borda de baixo escurece.
export function shade(G) {
  const src = G.map((r) => [...r]);
  const filled = (x, y) => inside(G, x, y) && src[y][x] !== ".";
  for (let y = 0; y < G.length; y++) {
    for (let x = 0; x < G[0].length; x++) {
      const c = src[y][x];
      if (c === ".") continue;
      if (!filled(x, y - 1) && LIGHT[c]) G[y][x] = LIGHT[c];
      else if (!filled(x, y + 1) && DARK[c]) G[y][x] = DARK[c];
    }
  }
}

export function outline(G, ch = "k") {
  const src = G.map((r) => [...r]);
  const filled = (x, y) => inside(G, x, y) && src[y][x] !== "." && src[y][x] !== ch;
  for (let y = 0; y < G.length; y++) {
    for (let x = 0; x < G[0].length; x++) {
      if (src[y][x] !== ".") continue;
      if (filled(x - 1, y) || filled(x + 1, y) || filled(x, y - 1) || filled(x, y + 1)) G[y][x] = ch;
    }
  }
}

export const finish = (G, { sym = true } = {}) => {
  if (sym) mirrorGrid(G);
  shade(G);
  outline(G);
  return toRows(G);
};
