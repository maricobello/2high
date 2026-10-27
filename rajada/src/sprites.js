// Pixel art do jogo inteiro, em texto: cada caractere é um pixel da paleta e
// "." é transparente. buildSprites() transforma em canvas (uma vez, no início).
// As peças grandes (chefes, couraçado, pedras, explosão) são desenhadas por um
// mini editor de pixels: formas simples, depois espelho, sombra e contorno.
import { createRng } from "./rng.js";
import { POWER } from "./config.js";
import { couracadoHD, portadorHD, pedraHD } from "./art-grandes.js";
import { colossoHD, aranhaHD, olhoHD, irisHD, serpenteHD, serpenteGomoHD, serpenteCaudaHD, forjaHD, rainhaHD } from "./art-chefes.js";
import { DARK, grid, toRows, set, rect, poly, ellipse, line, stamp, shade, outline, finish, spin4 } from "./pixel.js";

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

// ---------- chefes ----------

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
  pedra_m: spin4(rock(11, 8)),
  pedra_p: spin4(rock(7, 5)),
  mina: [MINA_A, MINA_B],
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
export const HD_SPRITES = {
  couracado: [couracadoHD(0), couracadoHD(1)],
  portador: [portadorHD(0), portadorHD(1)],
  pedra_g: [pedraHD(0), pedraHD(1), pedraHD(2), pedraHD(3)],
  colosso: [0, 1, 2, 3].map((f) => colossoHD(f)),
  aranha: [0, 1, 2, 3].map((f) => aranhaHD(f)),
  olho: [0, 1, 2].map((lid) => olhoHD(lid)),
  iris: [irisHD()],
  serpente: [serpenteHD(0), serpenteHD(1)],
  serpente_gomo: [serpenteGomoHD(0), serpenteGomoHD(1)],
  serpente_cauda: [serpenteCaudaHD()],
  forja: [0, 1, 2, 3].map((f) => forjaHD(f)),
  rainha: [0, 1, 2, 3].map((f) => rainhaHD(f)),
};

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
// Tiros pintados pela rampa de cada faixa de poder: cabeça clara, corpo
// médio, cauda escura. Gerados no início (não desenhados à mão): `tiro@3` é o
// tiro da faixa 3; o arco-íris usa as rampas das outras faixas.
const BULLETS = ["tiro", "tiro_max", "tiro_drone"];
const RAMP_SLOT = { w: 0, Y: 0, C: 0, y: 1, c: 1, o: 2, b: 2 };

export function buildSprites(makeCanvas) {
  const out = {};
  const add = (name, frames, hd, palette) => {
    out[name] = {
      frames: frames.map((rows) => paint(makeCanvas, rows, null, palette)),
      flash: frames.map((rows) => paint(makeCanvas, rows, "#ffffff")),
      flipped: name.endsWith("_bank") ? frames.map((rows) => paint(makeCanvas, flipX(rows), null, palette)) : null,
      ...worldSize(frames[0], hd),
      hd,
    };
  };
  for (const [name, frames] of Object.entries(SPRITES)) add(name, frames, false);
  for (const [name, frames] of Object.entries(HD_SPRITES)) add(name, frames, true);
  POWER.ramps.forEach((ramp, i) => {
    const palette = Object.fromEntries(Object.entries(RAMP_SLOT).map(([ch, slot]) => [ch, ramp[slot]]));
    for (const name of BULLETS) add(`${name}@${i}`, SPRITES[name], false, palette);
  });
  return out;
}

function paint(makeCanvas, rows, solid, palette = PALETTE) {
  const h = rows.length;
  const w = rows[0].length;
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext("2d");
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const ch = rows[y][x];
      if (ch === ".") continue;
      ctx.fillStyle = solid ?? palette[ch] ?? PALETTE[ch];
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
