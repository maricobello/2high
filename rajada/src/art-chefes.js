// Chefes em alta definição (grade com o dobro de pixels). Cada chefe é
// montado em camadas: estrutura simétrica (metade esquerda espelhada), depois
// os detalhes que não espelham (núcleo com luz de cima à esquerda, torretas,
// patas, asas) e por fim volume, brilho e contorno.
// Coordenadas em pixels da grade dobrada.
import { LIGHT, DARK, set, rect, poly, ellipse, line, mirrorGrid, outline, toRows } from "./pixel.js";
import { hdGrid, shade3, rim, dither } from "./pixel-hd.js";

// Esfera com luz de cima à esquerda: escuro, base, claro e brilho.
function orb(G, cx, cy, rx, ry, [dark, base, light, hi]) {
  ellipse(G, cx, cy, rx, ry, dark);
  ellipse(G, cx - rx * 0.12, cy - ry * 0.14, rx * 0.82, ry * 0.8, base);
  ellipse(G, cx - rx * 0.3, cy - ry * 0.32, rx * 0.42, ry * 0.4, light);
  if (hi) ellipse(G, cx - rx * 0.42, cy - ry * 0.45, Math.max(1, rx * 0.14), Math.max(1, ry * 0.13), hi);
}

// Placa com chanfro: borda de cima e da esquerda clara, de baixo e da direita escura.
function plate(G, x, y, w, h, base) {
  rect(G, x, y, w, h, base);
  const lt = LIGHT[base] ?? base;
  const dk = DARK[base] ?? base;
  rect(G, x, y, w, 1, lt);
  rect(G, x, y, 1, h, lt);
  rect(G, x, y + h - 1, w, 1, dk);
  rect(G, x + w - 1, y, 1, h, dk);
}

const finishBoss = (G, rimColor = "w") => {
  shade3(G);
  if (rimColor) rim(G, rimColor);
  outline(G);
  return toRows(G);
};

// ---------- Colosso: encouraçado com núcleo no meio ----------

// Direção do cano das torretas em cada quadro (gira entre os lados).
const TURRET_DIRS = [
  [-3, 4],
  [-1, 5],
  [3, 4],
  [1, 5],
];

function turret(G, x, y, frame, side) {
  const [dx, dy] = TURRET_DIRS[frame % 4];
  const ex = x + dx * side * 1.7;
  const ey = y + dy * 1.7;
  line(G, x, y, Math.round(ex), Math.round(ey), "g", 2);
  set(G, Math.round(ex), Math.round(ey), "r");
  ellipse(G, x, y, 4.6, 4.6, "d");
  ellipse(G, x - 0.6, y - 0.8, 3.2, 3, "l");
  set(G, x - 1, y - 2, "w");
}

// frame 0 a 3: chamas pulsando (par/ímpar) e torretas girando.
export function colossoHD(frame) {
  const G = hdGrid(63, 41); // 126 × 82
  const hot = frame % 2 ? "Y" : "y";
  // motores no topo: dois bocais por lado
  for (const x of [44, 55]) {
    rect(G, x, 5, 8, 7, "d");
    rect(G, x + 1, 5, 6, 1, "g");
    rect(G, x + 2, 0, 4, 5, "o");
    rect(G, x + 3, frame % 2 ? 0 : 1, 2, 5, hot);
  }
  // casco e asas
  poly(G, [[63, 10], [44, 14], [36, 28], [36, 56], [45, 68], [55, 76], [63, 81]], "g");
  poly(G, [[40, 24], [18, 32], [7, 43], [7, 54], [22, 57], [40, 58]], "d");
  // placas e rebites das asas
  line(G, 14, 45, 38, 45, "n");
  line(G, 18, 51, 38, 51, "n");
  for (const [x, y] of [[16, 40], [24, 37], [32, 34], [14, 48], [22, 48], [30, 48], [36, 54]]) set(G, x, y, "l");
  // casulos laterais com canhão
  rect(G, 1, 29, 10, 33, "l");
  rect(G, 2, 30, 2, 30, "w");
  rect(G, 8, 30, 2, 31, "g");
  line(G, 1, 40, 10, 40, "g");
  line(G, 1, 50, 10, 50, "g");
  rect(G, 3, 62, 6, 6, "d");
  rect(G, 4, 68, 4, 2, "r");
  // espinha e frisos do casco
  rect(G, 57, 14, 6, 58, "l");
  rect(G, 61, 14, 2, 58, "w");
  for (const [y, x0] of [[28, 38], [36, 37], [64, 45]]) line(G, x0, y, 56, y, "d");
  // janelas da ponte e luz da ponta da asa
  for (const x of [47, 51]) rect(G, x, 18, 2, 3, "c");
  rect(G, 10, 50, 3, 2, frame % 2 ? "r" : "R");
  // canhão da proa
  rect(G, 60, 72, 3, 8, "d");
  rect(G, 61, 80, 2, 2, "r");
  mirrorGrid(G);
  // núcleo (ponto fraco)
  ellipse(G, 63, 42, 13.5, 13.5, "d");
  orb(G, 63, 42, 12, 12, ["R", "r", "o", frame % 2 ? "w" : "Y"]);
  ellipse(G, 64, 43, 4, 4, hot);
  // torretas
  for (const [x, y, side] of [[22, 40, 1], [32, 46, 1], [104, 40, -1], [94, 46, -1]]) turret(G, x, y, frame, side);
  return finishBoss(G);
}

// ---------- Aranha: aranha mecânica de 8 patas ----------

const LEGS = {
  // [quadril, joelho, pé] em duas poses; os quadros intermediários levantam o joelho
  a: [
    [[44, 38], [24, 22], [8, 8]],
    [[42, 46], [18, 38], [4, 50]],
    [[42, 52], [20, 60], [8, 76]],
    [[48, 58], [32, 72], [28, 88]],
  ],
  b: [
    [[44, 38], [26, 18], [12, 6]],
    [[42, 46], [18, 42], [4, 54]],
    [[42, 52], [18, 56], [6, 72]],
    [[48, 58], [34, 74], [32, 88]],
  ],
};

function legPose(i, phase) {
  const A = LEGS.a[i];
  const B = LEGS.b[i];
  if (phase === 0) return A;
  if (phase === 2) return B;
  // a caminho: na ida o joelho sobe; na volta, o pé
  const lift = phase === 1 ? 1 : 2;
  return A.map((p, k) => [(p[0] + B[k][0]) / 2, (p[1] + B[k][1]) / 2 - (k === lift ? 4 : 0)]);
}

function leg(G, [hip, knee, foot]) {
  line(G, Math.round(hip[0]), Math.round(hip[1]), Math.round(knee[0]), Math.round(knee[1]), "V", 4);
  line(G, Math.round(knee[0]), Math.round(knee[1]), Math.round(foot[0]), Math.round(foot[1]), "V", 3);
  line(G, Math.round(hip[0]), Math.round(hip[1]) - 1, Math.round(knee[0]), Math.round(knee[1]) - 1, "v");
  ellipse(G, knee[0], knee[1], 2.6, 2.6, "v");
  rect(G, Math.round(foot[0]) - 1, Math.round(foot[1]) - 1, 3, 3, "U");
}

// frame 0 a 3: passo alternado (patas 1 e 3 de um lado com 2 e 4 do outro).
export function aranhaHD(frame) {
  const G = hdGrid(59, 46); // 118 × 92
  // abdômen com placas, tórax e cabeça (metade esquerda)
  ellipse(G, 59, 22, 21, 19, "V");
  for (const y of [10, 18, 26, 33]) line(G, 42, y, 58, y, "U");
  ellipse(G, 59, 48, 19, 16, "v");
  ellipse(G, 59, 68, 13, 11, "v");
  line(G, 46, 56, 58, 58, "V");
  // olhos e presas
  ellipse(G, 53, 66, 3.4, 3.4, "p");
  set(G, 52, 65, "q");
  ellipse(G, 48.5, 71, 2.4, 2.4, "p");
  rect(G, 54, 76, 2, 8, "w");
  rect(G, 55, 77, 1, 6, "l");
  rect(G, 54, 84, 2, 1, "g");
  mirrorGrid(G);
  // patas em passo alternado: lado direito espelhado e defasado
  for (let i = 0; i < 4; i++) {
    const phase = (frame + (i % 2) * 2) % 4;
    leg(G, legPose(i, phase));
    const other = legPose(i, (phase + 2) % 4).map(([x, y]) => [117 - x, y]);
    leg(G, other);
  }
  // núcleo no tórax
  orb(G, 59, 45, 8, 8, ["R", "r", "o", frame % 2 ? "Y" : "y"]);
  return finishBoss(G);
}

// ---------- Olho: olho gigante com coroa de espinhos ----------

// lid: 0 aberto, 1 semicerrado (vai atirar), 2 fechado (invulnerável)
export function olhoHD(lid) {
  const G = hdGrid(49, 47); // 98 × 94
  const cx = 49;
  const cy = 47;
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2 + Math.PI / 12;
    const tip = [cx + Math.cos(a) * 47, cy + Math.sin(a) * 45];
    const l = [cx + Math.cos(a - 0.2) * 36, cy + Math.sin(a - 0.2) * 36];
    const r = [cx + Math.cos(a + 0.2) * 36, cy + Math.sin(a + 0.2) * 36];
    poly(G, [tip, l, r], "R");
    line(G, Math.round(l[0]), Math.round(l[1]), Math.round(tip[0]), Math.round(tip[1]), "r");
  }
  // anel de carne com brilho em cima à esquerda
  ellipse(G, cx, cy, 40, 39, "R");
  ellipse(G, cx - 1, cy - 1.5, 37, 35, "q");
  ellipse(G, cx, cy, 35, 32, "r");
  ellipse(G, cx, cy + 1, 29, 25, "k");
  // esclera com sombra embaixo
  ellipse(G, cx, cy + 1, 27, 23, "w");
  ellipse(G, cx, cy + 8, 24, 16, "l");
  dither(G, 26, 52, 46, 2, "l", "w");
  ellipse(G, cx, cy + 2, 25, 19, "w");
  // veias
  const veins = [
    [[24, 52], [32, 47], [36, 48]],
    [[26, 40], [33, 42], [36, 40]],
    [[74, 50], [66, 46], [62, 48]],
    [[72, 38], [65, 41], [62, 39]],
  ];
  for (const v of veins) {
    for (let i = 0; i + 1 < v.length; i++) line(G, v[i][0], v[i][1], v[i + 1][0], v[i + 1][1], i ? "p" : "q");
  }
  if (lid) {
    // pálpebra desce até a metade (lid 1) ou fecha (lid 2)
    const bottom = lid === 2 ? 74 : 46;
    for (let y = 20; y <= bottom; y++) {
      for (let x = 0; x < G[0].length; x++) if ("wlqp".includes(G[y][x])) G[y][x] = "r";
    }
    for (let y = 26; y < bottom - 4; y += 7) line(G, 30, y, 68, y, "R");
    line(G, 22, bottom, 76, bottom, "R");
    line(G, 22, bottom + 1, 76, bottom + 1, "P");
    for (let x = 28; x <= 70; x += 6) line(G, x, bottom + 1, x - 1, bottom + 4, "k");
  }
  return finishBoss(G, "q");
}

// Íris que segue a nave (desenhada por cima do olho).
export function irisHD() {
  const G = hdGrid(11, 11); // 22 × 22
  ellipse(G, 11, 11, 10.8, 10.8, "N");
  ellipse(G, 11, 11, 9.2, 9.2, "b");
  ellipse(G, 10.4, 10.2, 7.6, 7.6, "B");
  for (let k = 0; k < 12; k++) {
    const a = (k * Math.PI) / 6;
    line(G, Math.round(11 + Math.cos(a) * 5), Math.round(11 + Math.sin(a) * 5), Math.round(11 + Math.cos(a) * 8.6), Math.round(11 + Math.sin(a) * 8.6), "b");
  }
  ellipse(G, 11, 11, 4.6, 4.6, "k");
  ellipse(G, 8.4, 8.2, 1.7, 1.7, "w");
  set(G, 13, 13, "N");
  return toRows(G);
}

// ---------- Serpente: cabeça, gomos e cauda ----------

// frame 0: boca fechada; 1: aberta.
export function serpenteHD(frame) {
  const G = hdGrid(26, 22); // 52 × 44
  poly(G, [[26, 2], [12, 6], [3, 16], [2, 26], [8, 32], [16, 34], [22, 40], [26, 43]], "E");
  poly(G, [[26, 6], [16, 10], [11, 20], [13, 30], [20, 36], [26, 39]], "e");
  rect(G, 24, 6, 2, 30, "m");
  // escamas douradas e espinhos do capuz
  line(G, 14, 12, 24, 8, "y");
  line(G, 12, 18, 22, 15, "o");
  for (const y of [12, 20, 28]) poly(G, [[4, y], [1, y + 2], [5, y + 4]], "m");
  // olhos
  ellipse(G, 18, 22, 3.6, 2.6, "r");
  set(G, 17, 21, "Y");
  // boca
  if (frame) {
    poly(G, [[17, 33], [26, 33], [26, 42], [21, 39]], "R");
    rect(G, 19, 34, 1, 4, "w");
    rect(G, 23, 36, 3, 4, "r");
  } else {
    line(G, 19, 36, 26, 36, "R");
  }
  mirrorGrid(G);
  return finishBoss(G, "m");
}

// Gomo blindado com a gema que dispara. frame: gema pulsando.
export function serpenteGomoHD(frame) {
  const G = hdGrid(16, 14); // 32 × 28
  ellipse(G, 16, 14, 15, 12.6, "E");
  ellipse(G, 15.4, 13, 12.6, 10.4, "e");
  line(G, 4, 14, 28, 14, "E");
  for (const y of [8, 18]) poly(G, [[2, y], [0, y + 2], [3, y + 3]], "m");
  mirrorGrid(G);
  orb(G, 16, 14, 4.2, 4.2, ["O", "o", frame ? "Y" : "y", frame ? "w" : null]);
  return finishBoss(G, "m");
}

export function serpenteCaudaHD() {
  const G = hdGrid(12, 12); // 24 × 24
  poly(G, [[12, 0], [4, 5], [6, 14], [12, 23]], "e");
  line(G, 6, 7, 12, 9, "E");
  line(G, 7, 12, 12, 15, "E");
  poly(G, [[5, 14], [1, 20], [9, 18]], "m");
  mirrorGrid(G);
  return finishBoss(G, "m");
}

// ---------- Forja: fábrica com fornalhas e pistões ----------

// frame 0 a 3: pistões sobem e descem, fogo das chaminés e fornalhas pulsa.
export function forjaHD(frame) {
  const G = hdGrid(70, 40); // 140 × 80
  const hot = frame % 2 ? "Y" : "y";
  const piston = [0, 3, 6, 2][frame % 4];
  // chaminés com fogo
  for (const [x, w, h] of [[22, 9, 16], [40, 7, 12]]) {
    rect(G, x, 2, w, h, "n");
    rect(G, x + 1, 2, w - 2, 2, "d");
    rect(G, x + 1, 0, w - 2, 2, frame % 2 ? "o" : "y");
  }
  // corpo principal e convés
  poly(G, [[70, 10], [40, 10], [22, 18], [10, 30], [6, 52], [14, 66], [34, 74], [70, 78]], "d");
  plate(G, 30, 14, 40, 12, "g");
  for (const x of [36, 48, 60]) rect(G, x, 16, 1, 8, "d");
  // fornalha
  rect(G, 18, 36, 20, 16, "k");
  rect(G, 20, 39, 16, 11, "R");
  rect(G, 22, 41, 12, 8, "o");
  rect(G, 25, 43, 6, 4, hot);
  line(G, 17, 35, 38, 35, "g");
  // pistões
  for (const x of [42, 54]) {
    rect(G, x + 1, 50 + piston, 3, 16, "l");
    rect(G, x - 1, 48 + piston, 7, 4, "g");
    rect(G, x - 1, 66, 7, 3, "n");
  }
  // frisos, rebites e respiros embaixo
  for (const y of [30, 58]) line(G, 12, y, 68, y, "n");
  for (const [x, y] of [[14, 32], [26, 32], [62, 32], [16, 60], [30, 62], [50, 70]]) set(G, x, y, "l");
  for (const x of [24, 36]) rect(G, x, 70, 6, 2, frame % 2 ? "o" : "O");
  mirrorGrid(G);
  // núcleo derretido (ponto fraco)
  ellipse(G, 70, 44, 13, 13, "O");
  orb(G, 70, 44, 11, 11, ["R", "r", "o", hot === "Y" ? "w" : "Y"]);
  return finishBoss(G, "l");
}

// ---------- Rainha: rainha da colmeia com coroa e asas ----------

// Posição das asas (ponta e borda de trás) em cada quadro: sobe, meio, desce, meio-baixo.
const WINGS = [
  { tip: [6, 10], back: [14, 32], small: [12, 44] },
  { tip: [2, 30], back: [16, 44], small: [10, 54] },
  { tip: [8, 56], back: [22, 60], small: [18, 70] },
  { tip: [3, 44], back: [18, 52], small: [14, 62] },
];

// frame 0 a 3: asas batendo.
export function rainhaHD(frame) {
  const G = hdGrid(64, 44); // 128 × 88
  const w = WINGS[frame % 4];
  const shoulder = [50, 42];
  // asas (membrana clara com nervuras), atrás do corpo
  poly(G, [shoulder, w.tip, w.back], "C");
  dither(G, Math.min(w.tip[0], w.back[0]) + 6, Math.min(w.tip[1], shoulder[1]) + 4, 10, 6, "C", "B");
  line(G, shoulder[0], shoulder[1], w.tip[0], w.tip[1], "c");
  line(G, shoulder[0], shoulder[1], Math.round((w.tip[0] + w.back[0]) / 2), Math.round((w.tip[1] + w.back[1]) / 2), "b");
  poly(G, [[shoulder[0], shoulder[1] + 6], w.small, [w.back[0] + 8, w.back[1] + 6]], "C");
  line(G, shoulder[0], shoulder[1] + 6, w.small[0], w.small[1], "c");
  // abdômen com faixas douradas
  ellipse(G, 64, 20, 18, 18, "v");
  for (const y of [9, 17, 25]) line(G, 48, y, 63, y, "y");
  ellipse(G, 64, 4, 4, 3, "V");
  // tórax e cabeça
  ellipse(G, 64, 46, 15, 12, "V");
  dither(G, 54, 40, 10, 6, "V", "v");
  ellipse(G, 64, 66, 12, 10, "v");
  // olhos compostos
  ellipse(G, 57, 64, 5, 6, "r");
  dither(G, 55, 62, 4, 5, "r", "R");
  set(G, 55, 61, "q");
  // mandíbulas
  poly(G, [[60, 74], [64, 76], [62, 80]], "l");
  // patas finas
  line(G, 52, 52, 44, 60, "U");
  line(G, 44, 60, 42, 68, "U");
  line(G, 54, 56, 48, 66, "U");
  // coroa
  poly(G, [[64, 52], [54, 56], [52, 50], [56, 53], [58, 48], [60, 53], [64, 46]], "y");
  set(G, 58, 50, "Y");
  mirrorGrid(G);
  // joia da coroa e núcleo no tórax (ponto fraco)
  ellipse(G, 64, 53, 2.4, 2.4, "r");
  orb(G, 64, 44, 6.5, 6.5, ["P", "p", "q", frame % 2 ? "w" : null]);
  return finishBoss(G, "u");
}
