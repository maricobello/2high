// Inimigos grandes em alta definição (grade com o dobro de pixels): Couraçado,
// Portador e pedra grande. Mesma silhueta das versões antigas, com placas,
// rebites, luzes e o dobro de detalhe. Coordenadas em pixels da grade dobrada.
import { createRng } from "./rng.js";
import { set, rect, poly, ellipse, line, outline, toRows, rotate } from "./pixel.js";
import { hdGrid, shade3, rim, dither, finishHD } from "./pixel-hd.js";

// Couraçado: nave pesada de frente para baixo, reator no meio (ponto de mira),
// dois motores no topo e três canhões embaixo. frame: chama, reator e luzes.
export function couracadoHD(frame) {
  const G = hdGrid(27, 23); // 54 × 46
  const hot = frame ? "Y" : "y";
  // motores no topo, com chama
  rect(G, 18, 4, 7, 5, "d");
  rect(G, 19, 0, 5, 4, "o");
  rect(G, 20, 0, 3, frame ? 4 : 3, hot);
  // casco central e asas blindadas
  poly(G, [[27, 3], [17, 8], [13, 20], [14, 34], [20, 42], [27, 45]], "g");
  poly(G, [[17, 12], [5, 18], [2, 30], [6, 37], [16, 35]], "d");
  // placas da asa: frisos e rebites
  line(G, 5, 25, 15, 24, "n");
  line(G, 5, 31, 15, 30, "n");
  for (const [x, y] of [[8, 21], [12, 20], [8, 28], [12, 27], [9, 34]]) set(G, x, y, "l");
  // canhões laterais com brilho no cano
  rect(G, 4, 35, 4, 8, "d");
  rect(G, 5, 35, 1, 7, "g");
  rect(G, 4, 43, 4, 2, "r");
  // espinha e frisos do casco
  rect(G, 24, 6, 3, 34, "l");
  line(G, 18, 14, 18, 32, "d");
  line(G, 20, 36, 24, 40, "d");
  // luz de navegação piscando na asa
  rect(G, 9, 23, 2, 1, frame ? "r" : "R");
  // reator em camadas
  ellipse(G, 27, 21, 9.4, 9.4, "l");
  ellipse(G, 27, 21, 7.6, 7.6, "R");
  ellipse(G, 27, 21, 6, 6, "o");
  ellipse(G, 27, 21, 4, 4, hot);
  ellipse(G, 27, 21, 2, 2, frame ? "w" : "Y");
  // cano central
  rect(G, 25, 32, 2, 11, "d");
  rect(G, 25, 43, 2, 2, "r");
  return finishHD(G);
}

// Portador: cargueiro oval com a cápsula brilhando na cúpula, cinto de luzes
// que corre e propulsores. frame: luzes e chamas alternadas.
export function portadorHD(frame) {
  const G = hdGrid(17, 9); // 34 × 18
  ellipse(G, 17, 8, 16.6, 7.2, "o");
  ellipse(G, 17, 7.4, 15, 6.2, "y");
  // cúpula com a carga
  ellipse(G, 17, 4.6, 7.4, 4.2, "O");
  ellipse(G, 17, 4.6, 6.2, 3.4, "Y");
  ellipse(G, 17, 4.2, 3.4, 2.2, "w");
  // cinto de luzes
  for (let i = 0; i < 5; i++) rect(G, 2 + i * 3, 9, 2, 2, (i + frame) % 2 ? "w" : "O");
  // base e propulsores
  rect(G, 6, 13, 11, 2, "O");
  for (const x of [8, 13]) {
    rect(G, x, 15, 2, 2, "d");
    set(G, x, 17, frame ? "y" : "o");
    set(G, x + 1, 17, frame ? "o" : "y");
  }
  return finishHD(G);
}

// Pedra grande: forma irregular com crateras, veios e rachaduras. Cada
// rotação gira a forma e só depois aplica luz e contorno, então a luz fica
// sempre vindo de cima à esquerda.
export function pedraHD(rot) {
  const rng = createRng(3);
  const size = 34;
  const c = size / 2;
  const R = c - 1.4;
  let G = hdGrid(17, 17);
  const bumps = Array.from({ length: 10 }, () => rng.range(0.8, 1));
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
  const mask = G.map((row) => row.map((ch) => ch !== "."));
  const inRock = (x, y) => mask[y]?.[x] === true;
  // manchas pontilhadas
  for (let k = 0; k < 3; k++) {
    const x = Math.round(c + rng.range(-R * 0.6, R * 0.4));
    const y = Math.round(c + rng.range(-R * 0.6, R * 0.4));
    const tmp = hdGrid(3, 2);
    dither(tmp, 0, 0, 6, 4, "s", "a");
    tmp.forEach((row, j) => row.forEach((ch, i) => inRock(x + i, y + j) && set(G, x + i, y + j, ch)));
  }
  // crateras: parede iluminada embaixo à direita, fundo escuro em cima à esquerda
  for (let k = 0; k < 3; k++) {
    const cx = c + rng.range(-R * 0.45, R * 0.45);
    const cy = c + rng.range(-R * 0.45, R * 0.45);
    const cr = rng.range(3, 5.5);
    ellipse(G, cx + 0.8, cy + 0.9, cr, cr * 0.85, "z");
    ellipse(G, cx, cy, cr, cr * 0.85, "S");
    ellipse(G, cx - 0.7, cy - 0.6, cr * 0.55, cr * 0.45, "Z");
  }
  // uma rachadura fina
  let x = c + rng.range(-5, 5);
  let y = c + rng.range(-5, 5);
  for (let k = 0; k < 4; k++) {
    const nx = x + rng.range(-2.5, 2.5);
    const ny = y + rng.range(1, 2.5);
    line(G, Math.round(x), Math.round(y), Math.round(nx), Math.round(ny), "S");
    x = nx;
    y = ny;
  }
  // tira o que vazou para fora da pedra (as formas não sabem do contorno)
  G = G.map((row, y) => row.map((ch, x) => (mask[y][x] ? ch : ".")));
  let rows = toRows(G);
  for (let i = 0; i < rot; i++) rows = rotate(rows);
  G = rows.map((r) => [...r]);
  shade3(G);
  rim(G, "z");
  outline(G);
  return toRows(G);
}
