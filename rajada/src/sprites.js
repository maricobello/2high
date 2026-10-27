// Pixel art do jogo inteiro, em texto: cada caractere é um pixel da paleta e
// "." é transparente. buildSprites() transforma em canvas (uma vez, no início).
// As peças grandes (chefes, couraçado, pedras, explosão) são desenhadas por um
// mini editor de pixels: formas simples, depois espelho, sombra e contorno.
import { createRng } from "./rng.js";
import { DARK, grid, toRows, set, rect, poly, ellipse, line, stamp, shade, outline, finish } from "./pixel.js";

export const PALETTE = {
  k: "#090c18", // contorno
  n: "#1a2550", // marinho
  N: "#2c3f86",
  b: "#3d6bff", // azul
  B: "#7cb4ff",
  c: "#48e4f0", // ciano
  C: "#c4fcff",
  w: "#f4f7ff", // branco
  l: "#b9c3dc", // cinzas
  g: "#7a849f",
  d: "#464e6a",
  y: "#ffd23f", // amarelo
  Y: "#fff4b0",
  o: "#ff8a2a", // laranja
  O: "#b4501a",
  r: "#ff3d55", // vermelho
  R: "#9c1a33",
  q: "#ffb3dc", // rosa
  p: "#ff5fb4",
  P: "#a01f72",
  u: "#d6bcff", // violeta
  v: "#a46bff",
  V: "#5a2fae",
  U: "#2f1b66",
  m: "#b6ffc4", // verde
  e: "#4ee36a",
  E: "#1d8f45",
  z: "#e8c9a4", // pedra
  s: "#c09a7a",
  a: "#8c6f5a",
  S: "#5a4032",
  Z: "#2e2019",
};

// ---------- utilidades de texto ----------

// Espelha a metade esquerda (a última coluna é o eixo e não se repete).
const mirror = (rows) => rows.map((r) => r + [...r.slice(0, -1)].reverse().join(""));
const flipX = (rows) => rows.map((r) => [...r].reverse().join(""));
const rotate = (rows) => {
  const h = rows.length;
  const w = rows[0].length;
  const out = [];
  for (let x = 0; x < w; x++) {
    let line = "";
    for (let y = h - 1; y >= 0; y--) line += rows[y][x];
    out.push(line);
  }
  return out;
};
const spin4 = (rows) => [rows, rotate(rows), rotate(rotate(rows)), rotate(rotate(rotate(rows)))];

// ---------- nave inclinada ----------

// Inclinação na curva: a asa do lado da curva encolhe 1 px e escurece.
function bank(rows) {
  const mid = Math.floor(rows[0].length / 2);
  return rows.map((r, y) => {
    if (y < 5) return r;
    const wing = [...r.slice(0, mid - 1)];
    const narrow = [".", wing[0], ...wing.slice(2)].map((ch) => (ch === "." ? ch : (DARK[ch] ?? ch)));
    return narrow.join("") + r.slice(mid - 1);
  });
}

// ---------- naves do jogador (bico para cima) ----------

const FAISCA = [
  ".......w.......",
  "......wlw......",
  "......wlw......",
  ".....lwcwl.....",
  ".....lcCcl.....",
  "....blwcwlb....",
  "....bllwllb....",
  "...bBlwwwlBb...",
  "..bBBlwwwlBBb..",
  ".bBBblwwwlbBBb.",
  "bBBbnlwgwlnbBBb",
  "rBbn.lgggl.nbBr",
  "rbn..dgdgd..nbr",
  ".....dd.dd.....",
];

const VESPA = [
  "......y......",
  ".....yYy.....",
  ".....ywy.....",
  "....kycyk....",
  "....ycCcy....",
  "...kyycyyk...",
  "...ykdydky...",
  "..yykyyykyy..",
  ".yyy.kdk.yyy.",
  "yyok.yyy.koyy",
  "yo...kdk...oy",
  "y....yyy....y",
  ".....dyd.....",
  ".....d.d.....",
];

const BIGORNA = [
  "........w........",
  ".......wlw.......",
  "......dwlwd......",
  "......lwcwl......",
  ".....dlcCcld.....",
  "....edlwcwlde....",
  "...eEdllwlldEe...",
  "..eEEdlwwwldEEe..",
  ".eEEEdlwwwldEEEe.",
  "eEEEEdlwgwldEEEEe",
  "eEgEEdlgggldEEgEe",
  "eEgE.ddgdgdd.EgEe",
  "eEE..ddd.ddd..EEe",
  "......dd.dd......",
];

const COMETA = [
  ".......w.......",
  "......wrw......",
  "......rwr......",
  ".....rwcwr.....",
  ".....rcCcr.....",
  "....orwcwro....",
  ".l..orrwrro..l.",
  "lwl.orwwwro.lwl",
  "lrl.orwwwro.lrl",
  "lrlorrwwwrrolrl",
  "lrorrOwgwOrrorl",
  "lOrOO.ggg.OOrOl",
  ".O.....g.....O.",
  ".....dd.dd.....",
];

// ---------- inimigos (bico para baixo) ----------

const ZANGAO_A = [
  "ee..EEE..ee",
  "eEe.EeE.eEe",
  ".eEEeeeEEe.",
  "..EeeeeeE..",
  "..eEyeyEe..",
  "...EeeeE...",
  "...e.E.e...",
  "..e.....e..",
];
const ZANGAO_B = [
  "....EEE....",
  "..eEEeEEe..",
  ".eEEeeeEEe.",
  "eEEeeeeeEEe",
  "e.eEyeyEe.e",
  "...EeeeE...",
  "...e.E.e...",
  "..e.....e..",
];

const DARDO_A = [
  "o.......o",
  "Rr.....rR",
  "Rrr...rrR",
  ".Rrr.rrR.",
  ".RrrwrrR.",
  "..RrwrR..",
  "..RrwrR..",
  "...rwr...",
  "...RlR...",
  "....r....",
  "....R....",
];
const DARDO_B = [
  "y.......y",
  "Rr.....rR",
  "Rrr...rrR",
  ".Rrr.rrR.",
  ".RrrwrrR.",
  "..RrwrR..",
  "..RrwrR..",
  "...rwr...",
  "...RlR...",
  "....r....",
  "....R....",
];

const ATIRADOR_A = [
  "....VVVVV....",
  "..VvvvvvvvV..",
  ".VvBwvvvvvvV.",
  "VvvBvvvvvvvvV",
  "VvvvvvvvvvvvV",
  ".VVvVVVVVvVV.",
  "..VvVdddVvV..",
  "...V.dgd.V...",
  ".....dgd.....",
  "......r......",
];
const ATIRADOR_B = [
  "....VVVVV....",
  "..VvvvvvvvV..",
  ".VvBwvvvvvvV.",
  "VvvBvvvvvvvvV",
  "VvvvvvvvvvvvV",
  ".VVvVVVVVvVV.",
  "..VvVdddVvV..",
  "...V.dgd.V...",
  ".....dgd.....",
  "......y......",
];

function couracado(frame) {
  const G = grid(27, 23);
  const glow = frame ? "Y" : "y";
  rect(G, 11, 0, 3, 2, frame ? "y" : "o"); // motor
  poly(G, [[13.5, 1], [8, 3], [6, 9], [7, 17], [10, 21], [13.5, 22]], "g");
  poly(G, [[8, 6], [2, 9], [1, 15], [3, 18], [8, 17]], "d");
  rect(G, 2, 17, 2, 4, "d"); // canhões laterais
  set(G, 2, 21, "r");
  set(G, 3, 21, "r");
  rect(G, 12, 3, 2, 16, "l"); // espinha
  ellipse(G, 13.5, 10.5, 4.6, 4.6, "l");
  ellipse(G, 13.5, 10.5, 3, 3, "o");
  ellipse(G, 13.5, 10.5, 1.6, 1.6, glow);
  rect(G, 13, 15, 1, 6, "d"); // cano central
  set(G, 13, 21, "r");
  set(G, 9, 6, "r");
  return finish(G);
}

function rock(size, seed) {
  const rng = createRng(seed);
  const G = grid(size, size);
  const c = size / 2;
  const R = size / 2 - 1.2;
  const bumps = Array.from({ length: 8 }, () => rng.range(0.78, 1));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const a = ((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * bumps.length;
      const i = Math.floor(a) % bumps.length;
      const t = a - Math.floor(a);
      const r = R * (bumps[i] * (1 - t) + bumps[(i + 1) % bumps.length] * t);
      if (dx * dx + dy * dy <= r * r) G[y][x] = "a";
    }
  }
  const craters = size > 12 ? 3 : size > 7 ? 2 : 0;
  for (let k = 0; k < craters; k++) {
    const cx = c + rng.range(-R * 0.45, R * 0.45);
    const cy = c + rng.range(-R * 0.45, R * 0.45);
    const cr = rng.range(1.2, size > 12 ? 2.4 : 1.6);
    ellipse(G, cx, cy + 0.6, cr, cr * 0.8, "s");
    ellipse(G, cx, cy, cr, cr * 0.8, "S");
  }
  shade(G);
  outline(G);
  return toRows(G);
}

const MINA_A = [
  "....r....",
  ".r.RRR.r.",
  "..RRrRR..",
  ".RRrwrRR.",
  "rRrwywrRr",
  ".RRrwrRR.",
  "..RRrRR..",
  ".r.RRR.r.",
  "....r....",
];
const MINA_B = [
  "....R....",
  ".R.RRR.R.",
  "..RRrRR..",
  ".RRrrrRR.",
  "RRrrRrrRR",
  ".RRrrrRR.",
  "..RRrRR..",
  ".R.RRR.R.",
  "....R....",
];

const PORTADOR_A = [
  "......OOOOO......",
  "....OoyyyyyoO....",
  "..OoyYwwwwwYyoO..",
  ".OyyyyyyyyyyyyyO.",
  "OoyoyoyoyoyoyoyoO",
  ".OyyyyyyyyyyyyyO.",
  "..OoyyyyyyyyyoO..",
  "....OOoooooOO....",
  "......O.O.O......",
];
const PORTADOR_B = [
  "......OOOOO......",
  "....OoyyyyyoO....",
  "..OoyYwwwwwYyoO..",
  ".OyyyyyyyyyyyyyO.",
  "OyoyoyoyoyoyoyoyO",
  ".OyyyyyyyyyyyyyO.",
  "..OoyyyyyyyyyoO..",
  "....OOoooooOO....",
  ".....O.O.O.O.....",
];

// ---------- chefes ----------

const TORRETA = [".ddd.", "dlllg", "dlrld", "dgggd", "..d.."];

function colosso(frame) {
  const G = grid(63, 41);
  const flame = frame ? "Y" : "y";
  // chamas e bocais dos motores (no topo: o chefe vem de cima)
  rect(G, 23, 0, 3, 2, "o");
  set(G, 24, 0, flame);
  rect(G, 30, 0, 2, 2, "o");
  set(G, 31, 0, flame);
  rect(G, 22, 2, 5, 3, "d");
  rect(G, 29, 2, 3, 3, "d");
  rect(G, 20, 5, 12, 4, "g");
  // casco central
  poly(G, [[31.5, 6], [22, 8], [19, 14], [19, 28], [23, 34], [28, 38], [31.5, 40]], "g");
  rect(G, 29, 8, 3, 28, "l");
  // asas
  poly(G, [[20, 13], [9, 17], [4, 22], [4, 27], [12, 28], [20, 29]], "g");
  line(G, 8, 23, 19, 23, "d");
  line(G, 11, 26, 19, 26, "d");
  // casulos laterais com canhão
  rect(G, 1, 15, 5, 16, "l");
  rect(G, 2, 31, 3, 3, "d");
  set(G, 3, 34, "r");
  line(G, 3, 16, 3, 29, "w");
  // núcleo (ponto fraco)
  ellipse(G, 31.5, 21, 6.2, 6.2, "R");
  ellipse(G, 31.5, 21, 4.6, 4.6, "r");
  ellipse(G, 31.5, 21, 2.6, 2.6, flame);
  // torretas e canhão da proa
  stamp(G, TORRETA, 10, 18);
  stamp(G, TORRETA, 15, 22);
  rect(G, 30, 37, 2, 4, "d");
  set(G, 31, 40, "r");
  return finish(G);
}

const PERNAS = [
  [
    [[22, 19], [12, 11], [4, 4]],
    [[21, 23], [9, 19], [2, 25]],
    [[21, 26], [10, 30], [4, 38]],
    [[24, 29], [16, 36], [14, 44]],
  ],
  [
    [[22, 19], [13, 9], [6, 3]],
    [[21, 23], [9, 21], [2, 27]],
    [[21, 26], [9, 28], [3, 36]],
    [[24, 29], [17, 37], [16, 44]],
  ],
];

function aranha(frame) {
  const G = grid(59, 46);
  for (const [hip, knee, foot] of PERNAS[frame]) {
    line(G, hip[0], hip[1], knee[0], knee[1], "V", 2);
    line(G, knee[0], knee[1], foot[0], foot[1], "V", 2);
    set(G, knee[0], knee[1], "v");
  }
  ellipse(G, 29.5, 11, 10.5, 9.5, "V"); // abdômen
  for (const y of [5, 9, 13]) line(G, 22, y, 29, y, "U");
  ellipse(G, 29.5, 24, 9.5, 8, "v"); // tórax
  ellipse(G, 29.5, 34, 6.5, 5.5, "v"); // cabeça
  ellipse(G, 26.5, 33, 1.7, 1.7, "p");
  ellipse(G, 24.5, 35.5, 1.2, 1.2, "p");
  set(G, 26, 32, "w");
  rect(G, 27, 38, 1, 4, "w"); // presas
  ellipse(G, 29.5, 22, 3.6, 3.6, "r"); // núcleo
  ellipse(G, 29.5, 22, 1.8, 1.8, frame ? "Y" : "y");
  return finish(G);
}

// lid: 0 aberto, 1 semicerrado (vai atirar), 2 fechado (invulnerável)
function olho(lid) {
  const G = grid(49, 47);
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + Math.PI / 12;
    const tip = [24.5 + Math.cos(a) * 23.5, 23.5 + Math.sin(a) * 22.5];
    const l = [24.5 + Math.cos(a - 0.2) * 18, 23.5 + Math.sin(a - 0.2) * 18];
    const r = [24.5 + Math.cos(a + 0.2) * 18, 23.5 + Math.sin(a + 0.2) * 18];
    poly(G, [tip, l, r], "R");
  }
  ellipse(G, 24.5, 23.5, 20, 19.5, "R");
  ellipse(G, 24.5, 23.5, 17.5, 16, "r");
  ellipse(G, 24.5, 24, 14.5, 12.5, "k");
  ellipse(G, 24.5, 24, 13.5, 11.5, "w");
  ellipse(G, 24.5, 27, 12, 8.5, "l");
  ellipse(G, 24.5, 24.5, 12.5, 10, "w");
  line(G, 12, 26, 17, 23, "q");
  line(G, 13, 20, 17, 21, "q");
  if (lid) {
    const bottom = lid === 2 ? 37 : 22;
    for (let y = 10; y <= bottom; y++) {
      for (let x = 0; x < 49; x++) if (G[y][x] === "w" || G[y][x] === "l" || G[y][x] === "q") G[y][x] = "r";
    }
    line(G, 11, bottom, 24, bottom, "R");
  }
  return finish(G);
}

const IRIS = [
  "...NNNNN...",
  ".NNbbbbbNN.",
  ".NbBBBBBbN.",
  "NbBBkkkBBbN",
  "NbBkkkkkBbN",
  "NbBkkkkwBbN",
  "NbBkkkkkBbN",
  "NbBBkkkBBbN",
  ".NbBBBBBbN.",
  ".NNbbbbbNN.",
  "...NNNNN...",
];

// ---------- itens, tiros e efeitos ----------

// Cápsula: casca arredondada com a letra no meio (5x5).
const GLYPHS = {
  M: ["#...#", "##.##", "#.#.#", "#...#", "#...#"],
  F: ["#####", "#....", "####.", "#....", "#...."],
  D: ["####.", "#...#", "#...#", "#...#", "####."],
  E: ["#####", "#....", "####.", "#....", "#####"],
  H: [".#.#.", "#####", "#####", ".###.", "..#.."],
  P: ["..#..", "#.#.#", ".###.", "#.#.#", "..#.."],
};

function capsule(glyph, body, dark, light) {
  const shell = [
    "..kkkkkkk..",
    ".kLLLLLLLk.",
    "kLBBBBBBBDk",
    "kLBBBBBBBDk",
    "kLBBBBBBBDk",
    "kLBBBBBBBDk",
    "kLBBBBBBBDk",
    "kLBBBBBBBDk",
    "kLBBBBBBBDk",
    ".kDDDDDDDk.",
    "..kkkkkkk..",
  ].map((r) => r.replaceAll("L", light).replaceAll("B", body).replaceAll("D", dark));
  const g = GLYPHS[glyph];
  return shell.map((row, y) => {
    const gy = y - 3;
    if (gy < 0 || gy > 4) return row;
    return [...row].map((ch, x) => (x >= 3 && x <= 7 && g[gy][x - 3] === "#" ? "k" : ch)).join("");
  });
}

const CRISTAL = [
  ["..c..", ".cCc.", "cCwcb", "cCccb", ".ccb.", "..b.."],
  ["..c..", ".cCb.", ".Cwb.", ".ccb.", ".cb..", "..b.."],
  ["..c..", "..C..", "..w..", "..c..", "..b..", "..b.."],
  ["..c..", ".bCc.", ".bwc.", ".bcc.", "..bc.", "..b.."],
];

// Explosão clássica em 5 quadros: clarão, bola de fogo, anel, pedaços, fumaça.
function boom(frame) {
  const rng = createRng(77 + frame);
  const G = grid(19, 19);
  const c = 9.5;
  if (frame === 0) {
    ellipse(G, c, c, 4, 4, "y");
    ellipse(G, c, c, 2.5, 2.5, "Y");
    ellipse(G, c, c, 1.2, 1.2, "w");
  } else if (frame === 1) {
    ellipse(G, c, c, 7, 7, "o");
    ellipse(G, c, c, 5, 5, "y");
    ellipse(G, c, c, 3, 3, "Y");
  } else if (frame === 2) {
    ellipse(G, c, c, 8.6, 8.6, "r");
    ellipse(G, c, c, 7.4, 7.4, "o");
    ellipse(G, c, c, 6, 6, "y");
    ellipse(G, c, c, 4.6, 4.6, ".");
  } else {
    const n = frame === 3 ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rng.range(-0.3, 0.3);
      const d = rng.range(5, 7.5);
      const r = frame === 3 ? rng.range(1.2, 2) : rng.range(1.4, 2.4);
      ellipse(G, c + Math.cos(a) * d, c + Math.sin(a) * d, r, r, frame === 3 ? rng.pick(["r", "o"]) : "g");
    }
    shade(G);
  }
  return toRows(G);
}

function ring(r, ch, size) {
  const G = grid(size, size);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - c, y + 0.5 - c);
      if (d <= r && d > r - 1.2) G[y][x] = ch;
    }
  }
  return G;
}

function escudo(frame) {
  const G = ring(10.5, "c", 23);
  // brilho que gira em volta
  for (let i = 0; i < 3; i++) {
    const a = frame * (Math.PI / 2) + i * 0.22;
    set(G, 11.5 + Math.cos(a) * 9.9 - 0.5, 11.5 + Math.sin(a) * 9.9 - 0.5, "C");
  }
  return toRows(G);
}

export const SPRITES = {
  faisca: [FAISCA],
  faisca_bank: [bank(FAISCA)],
  vespa: [VESPA],
  vespa_bank: [bank(VESPA)],
  bigorna: [BIGORNA],
  bigorna_bank: [bank(BIGORNA)],
  cometa: [COMETA],
  cometa_bank: [bank(COMETA)],
  chama: [
    ["yy", "oo", ".o", ".."],
    ["YY", "yy", "oo", "o."],
    ["yy", "yo", "o.", ".."],
  ],
  drone: [["...w...", "..ece..", ".eEcEe.", "eEEwEEe", "eE.e.Ee", "...d..."]],
  escudo: [escudo(0), escudo(1), escudo(2), escudo(3)],
  zangao: [ZANGAO_A, ZANGAO_B],
  dardo: [DARDO_A, DARDO_B],
  atirador: [ATIRADOR_A, ATIRADOR_B],
  couracado: [couracado(0), couracado(1)],
  pedra_g: spin4(rock(17, 3)),
  pedra_m: spin4(rock(11, 8)),
  pedra_p: spin4(rock(7, 5)),
  mina: [MINA_A, MINA_B],
  portador: [PORTADOR_A, PORTADOR_B],
  colosso: [colosso(0), colosso(1)],
  aranha: [aranha(0), aranha(1)],
  olho: [olho(0), olho(1), olho(2)],
  iris: [IRIS],
  cap_M: [capsule("M", "y", "O", "Y"), capsule("M", "Y", "y", "w")],
  cap_F: [capsule("F", "o", "R", "y"), capsule("F", "y", "o", "Y")],
  cap_D: [capsule("D", "e", "E", "m"), capsule("D", "m", "e", "w")],
  cap_E: [capsule("E", "c", "b", "C"), capsule("E", "C", "c", "w")],
  cap_H: [capsule("H", "p", "P", "q"), capsule("H", "q", "p", "w")],
  cap_P: [capsule("P", "v", "V", "u"), capsule("P", "u", "v", "w")],
  cristal: CRISTAL,
  boom: [boom(0), boom(1), boom(2), boom(3), boom(4)],
  tiro: [["Yw", "yY", "yy", "oy", "o."]],
  tiro_max: [[".Y.", "YwY", "yYy", "yyy", "oyo", ".o."]],
  tiro_drone: [["C", "c", "c", "b"]],
  foguete: [[".w.", "lwl", "lrl", "lrl", "r.r"]],
  bala: [
    [".kkk.", "kpqpk", "kqwqk", "kpqpk", ".kkk."],
    [".kkk.", "kqqqk", "kqwqk", "kqqqk", ".kkk."],
  ],
  bolha: [
    ["..kkk..", ".kpppk.", "kpqqqpk", "kpqwqpk", "kpqqqpk", ".kpppk.", "..kkk.."],
    ["..kkk..", ".kqqqk.", "kqwwwqk", "kqwwwqk", "kqwwwqk", ".kqqqk.", "..kkk.."],
  ],
  orbe: [
    ["..kkk..", ".koook.", "koyyyok", "koyYyok", "koyyyok", ".koook.", "..kkk.."],
    ["..kkk..", ".kyyyk.", "kyYYYyk", "kyYwYyk", "kyYYYyk", ".kyyyk.", "..kkk.."],
  ],
  agulha: [["kk", "pq", "qw", "qw", "pq", "kk"]],
  coracao: [[".rr.rr.", "rwrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."]],
  trevo: [
    [
      ".ee...ee.",
      "emEe.eEme",
      "eEEEeEEEe",
      ".eEEeEEe.",
      "...eEe...",
      ".eEEeEEe.",
      "eEEEeEEEe",
      "emEe.eEme",
      ".ee.E.ee.",
      "....E....",
    ],
  ],
  ima: [
    [
      "ww...ww",
      "ll...ll",
      "rr...rr",
      "rR...Rr",
      "rR...Rr",
      "rRr.rRr",
      ".rRRRr.",
      "..rrr..",
    ],
  ],
  coracao_vazio: [[".dd.dd.", "d..d..d", "d.....d", ".d...d.", "..d.d..", "...d..."]],
};

// Sprites em alta definição: grade com o dobro de pixels (cada unidade do
// mundo vale 2×2 pixels). A arte entra aqui pelos arquivos art-*.js.
export const HD_SPRITES = {};

export const isHd = (name) => Object.hasOwn(HD_SPRITES, name);

// Tamanho no mundo de um quadro (alta definição: metade da grade).
export const worldSize = (rows, hd) => (hd ? { w: rows[0].length / 2, h: rows.length / 2 } : { w: rows[0].length, h: rows.length });

// Tamanho do primeiro quadro no mundo (colisão e desenho usam o mesmo número).
export function sizeOf(name) {
  const hd = isHd(name);
  return worldSize((hd ? HD_SPRITES : SPRITES)[name][0], hd);
}

// Cria os canvas de cada quadro, mais uma versão branca (piscada de dano).
// makeCanvas(w, h) devolve um canvas; no navegador é document.createElement.
// Sprites em alta definição saem com hd: true e w/h no mundo; o desenho usa
// esses números para encaixar a grade dobrada no mesmo espaço.
export function buildSprites(makeCanvas) {
  const out = {};
  const add = (name, frames, hd) => {
    out[name] = {
      frames: frames.map((rows) => paint(makeCanvas, rows, null)),
      flash: frames.map((rows) => paint(makeCanvas, rows, "#ffffff")),
      flipped: name.endsWith("_bank") ? frames.map((rows) => paint(makeCanvas, flipX(rows), null)) : null,
      ...worldSize(frames[0], hd),
      hd,
    };
  };
  for (const [name, frames] of Object.entries(SPRITES)) add(name, frames, false);
  for (const [name, frames] of Object.entries(HD_SPRITES)) add(name, frames, true);
  return out;
}

function paint(makeCanvas, rows, solid) {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === ".") continue;
      ctx.fillStyle = solid ?? PALETTE[ch];
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

// Usado pelos testes: todo quadro de um sprite tem o mesmo tamanho e só cores
// da paleta; em alta definição, largura e altura pares (cabem no mundo).
export function validateSprites() {
  const problems = [];
  for (const [name, frames] of [...Object.entries(SPRITES), ...Object.entries(HD_SPRITES)]) {
    const w = frames[0][0].length;
    const h = frames[0].length;
    if (isHd(name) && (w % 2 || h % 2)) problems.push(`${name} em alta definição com tamanho ímpar ${w}×${h}`);
    frames.forEach((rows, i) => {
      if (rows.length !== h) problems.push(`${name}[${i}] altura ${rows.length} ≠ ${h}`);
      rows.forEach((r, y) => {
        if (r.length !== w) problems.push(`${name}[${i}] linha ${y} largura ${r.length} ≠ ${w}`);
        for (const ch of r) if (ch !== "." && !PALETTE[ch]) problems.push(`${name}[${i}] cor "${ch}"`);
      });
    });
  }
  return problems;
}

export { flipX, mirror };
