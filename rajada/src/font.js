// Fonte de pixels 3x5 para os textos dentro do canvas (pontos, avisos curtos).
// Só maiúsculas, números e alguns sinais; acentos e cedilha saem na hora de
// desenhar (LENDÁRIA vira LENDARIA).

const G = {
  A: ["###", "#.#", "###", "#.#", "#.#"],
  B: ["##.", "#.#", "##.", "#.#", "##."],
  C: ["###", "#..", "#..", "#..", "###"],
  D: ["##.", "#.#", "#.#", "#.#", "##."],
  E: ["###", "#..", "##.", "#..", "###"],
  F: ["###", "#..", "##.", "#..", "#.."],
  G: ["###", "#..", "#.#", "#.#", "###"],
  H: ["#.#", "#.#", "###", "#.#", "#.#"],
  I: ["###", ".#.", ".#.", ".#.", "###"],
  J: ["..#", "..#", "..#", "#.#", "###"],
  K: ["#.#", "#.#", "##.", "#.#", "#.#"],
  L: ["#..", "#..", "#..", "#..", "###"],
  M: ["#.#", "###", "###", "#.#", "#.#"],
  N: ["##.", "#.#", "#.#", "#.#", "#.#"],
  O: ["###", "#.#", "#.#", "#.#", "###"],
  P: ["###", "#.#", "###", "#..", "#.."],
  Q: ["###", "#.#", "#.#", "###", "..#"],
  R: ["##.", "#.#", "##.", "#.#", "#.#"],
  S: ["###", "#..", "###", "..#", "###"],
  T: ["###", ".#.", ".#.", ".#.", ".#."],
  U: ["#.#", "#.#", "#.#", "#.#", "###"],
  V: ["#.#", "#.#", "#.#", "#.#", ".#."],
  W: ["#.#", "#.#", "###", "###", "#.#"],
  X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
  Y: ["#.#", "#.#", ".#.", ".#.", ".#."],
  Z: ["###", "..#", ".#.", "#..", "###"],
  0: ["###", "#.#", "#.#", "#.#", "###"],
  1: [".#.", "##.", ".#.", ".#.", "###"],
  2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", "###", "..#", "###"],
  4: ["#.#", "#.#", "###", "..#", "..#"],
  5: ["###", "#..", "###", "..#", "###"],
  6: ["###", "#..", "###", "#.#", "###"],
  7: ["###", "..#", "..#", "..#", "..#"],
  8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "###"],
  "+": ["...", ".#.", "###", ".#.", "..."],
  "-": ["...", "...", "###", "...", "..."],
  "×": ["...", "#.#", ".#.", "#.#", "..."],
  ".": ["...", "...", "...", "...", ".#."],
  "!": [".#.", ".#.", ".#.", "...", ".#."],
  "?": ["###", "..#", ".##", "...", ".#."],
  ":": ["...", ".#.", "...", ".#.", "..."],
  "%": ["#.#", "..#", ".#.", "#..", "#.#"],
  "/": ["..#", "..#", ".#.", "#..", "#.."],
  "·": ["...", "...", ".#.", "...", "..."],
  "★": ["..#..", "..#..", "#####", ".###.", ".#.#."], // a única mais larga
  " ": ["...", "...", "...", "...", "..."],
};

export const FONT_H = 5;

const plain = (text) =>
  String(text)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();

const glyphOf = (ch) => G[ch] ?? G["?"];

export function textWidth(text, scale = 1) {
  let w = 0;
  for (const ch of plain(text)) w += glyphOf(ch)[0].length + 1;
  return Math.max(0, w - 1) * scale;
}

// Desenha o texto com contorno escuro (legível sobre qualquer fundo).
// align: "left" | "center"; x, y: canto de cima (ou centro horizontal).
export function drawText(ctx, text, x, y, color, { scale = 1, align = "center", outline = "#090c18" } = {}) {
  const str = plain(text);
  let cx = Math.round(align === "center" ? x - textWidth(str, scale) / 2 : x);
  const top = Math.round(y);
  const pixels = [];
  for (const ch of str) {
    const glyph = glyphOf(ch);
    const w = glyph[0].length;
    for (let r = 0; r < 5; r++) for (let c = 0; c < w; c++) if (glyph[r][c] === "#") pixels.push([cx + c * scale, top + r * scale]);
    cx += (w + 1) * scale;
  }
  if (outline) {
    ctx.fillStyle = outline;
    for (const [px, py] of pixels) ctx.fillRect(px - 1, py - 1, scale + 2, scale + 2);
  }
  ctx.fillStyle = color;
  for (const [px, py] of pixels) ctx.fillRect(px, py, scale, scale);
}
