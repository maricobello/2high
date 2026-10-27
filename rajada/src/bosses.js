// Chefes: entrada, movimento e roteiro de ataques. Cada ataque tem duração,
// intervalo entre disparos e a função que dispara. Abaixo de 50% de vida o
// chefe entra na fase 2: roteiro novo e tiros mais frequentes.
import { BOSSES, W, lapSkin } from "./config.js";
import { sizeOf } from "./sprites.js";

const DOWN = Math.PI / 2;

function fan(g, x, y, n, step, speed, kind, angle) {
  for (let i = 0; i < n; i++) g.fire(x, y, angle + (i - (n - 1) / 2) * step, speed, kind);
}

function ring(g, x, y, n, speed, kind, offset) {
  for (let i = 0; i < n; i++) g.fire(x, y, offset + (i / n) * Math.PI * 2, speed, kind);
}

const ATTACKS = {
  // ----- Colosso -----
  leque: { dur: 1.8, every: 0.55, fire: (b, g) => fan(g, b.x, b.y + 20, 5, 0.22, 92, "bala", g.aimAngle(b.x, b.y + 20)) },
  leque7: { dur: 1.8, every: 0.5, fire: (b, g) => fan(g, b.x, b.y + 20, 7, 0.18, 100, "bala", g.aimAngle(b.x, b.y + 20)) },
  gemeos: {
    dur: 1.4,
    every: 0.1,
    fire: (b, g, i) => g.fire(b.x + (i % 2 ? 28 : -28), b.y + 18, DOWN, 160, "agulha"),
  },
  torretas: {
    dur: 1.2,
    every: 0.24,
    fire: (b, g, i) => {
      const x = b.x + (i % 2 ? 18 : -18);
      g.fire(x, b.y + 4, g.aimAngle(x, b.y + 4), 110, "bala");
    },
  },
  espiral: {
    dur: 2.6,
    every: 0.07,
    fire: (b, g, i) => {
      for (const arm of [0, Math.PI]) g.fire(b.x, b.y, i * 0.32 + arm, 70, "bolha");
    },
  },
  anel: { dur: 1.2, every: 0.45, fire: (b, g, i) => ring(g, b.x, b.y, 18, 64, "bolha", i * 0.17) },
  pausa: { dur: 0.7 },

  // ----- Aranha -----
  teia: {
    dur: 2,
    every: 0.11,
    fire: (b, g, i) => {
      for (let k = 0; k < 4; k++) g.fire(b.x, b.y + 4, i * 0.21 + (k * Math.PI) / 2, 62, "bala");
    },
  },
  teia6: {
    dur: 2.2,
    every: 0.12,
    fire: (b, g, i) => {
      const dir = Math.floor(i / 6) % 2 ? -1 : 1;
      for (let k = 0; k < 6; k++) g.fire(b.x, b.y + 4, dir * i * 0.17 + (k * Math.PI) / 3, 66, "bala");
    },
  },
  bote: {
    dur: 1.6,
    every: 0.42,
    fire: (b, g) => fan(g, b.x, b.y + 22, 3, 0.16, 130, "bolha", g.aimAngle(b.x, b.y + 22)),
  },
  patas: {
    dur: 1.5,
    every: 0.16,
    fire: (b, g, i) => {
      const side = i % 2 ? 1 : -1;
      const x = b.x + side * (14 + (i % 4) * 4);
      const y = b.y + 6 + (i % 3) * 6;
      g.fire(x, y, g.aimAngle(x, y), 120, "agulha");
    },
  },
  chuva: {
    dur: 2.2,
    every: 0.15,
    fire: (b, g) => g.fire(g.rng.range(8, g.W - 8), -4, DOWN + g.rng.range(-0.08, 0.08), 115, "agulha"),
  },

  // ----- Olho -----
  olhar: {
    dur: 1.4,
    every: 0.18,
    fire: (b, g) => g.fire(b.x, b.y + 2, g.aimAngle(b.x, b.y + 2), 140, "agulha"),
  },
  // Laser mira onde você está; a linha fina avisa antes. Desvia saindo da linha.
  laser: {
    dur: 2.2,
    lid: 1,
    still: true,
    start: (b, g) => {
      const a = g.aimAngle(b.x, b.y + 2);
      g.laser(b, a, a, 0.9, 1);
    },
  },
  // Tesoura: dois feixes nascem rentes a você e abrem para os lados.
  laser2: {
    dur: 2.9,
    lid: 1,
    still: true,
    start: (b, g) => {
      const a = g.aimAngle(b.x, b.y + 2);
      g.laser(b, a - 0.07, a - 0.6, 1, 1.6);
      g.laser(b, a + 0.07, a + 0.6, 1, 1.6);
    },
  },
  orbes: {
    dur: 1.8,
    every: 0.45,
    fire: (b, g, i) => g.fire(b.x, b.y + 6, DOWN + (i % 2 ? 0.7 : -0.7), 66, "orbe", { home: 1.5 }),
  },
  piscar: {
    dur: 1.7,
    lid: 2,
    every: 0.8,
    fire: (b, g, i) => ring(g, b.x, b.y, 14, 58, "bala", i * 0.22),
  },

  // ----- Serpente -----
  // os gomos atiram em ordem, da cabeça para a cauda
  gomos: {
    dur: 2.4,
    every: 0.2,
    fire: (b, g, i) => {
      const s = b.segments[i % b.segments.length];
      g.fire(s.x, s.y, g.aimAngle(s.x, s.y), 100, "bala");
    },
  },
  anel_serpente: { dur: 1.2, every: 0.4, mouth: true, fire: (b, g, i) => ring(g, b.x, b.y + 4, 16, 70, "bolha", i * 0.2) },

  // ----- Forja -----
  // onda de fogo: uma fileira cobrindo a largura com um vão de 28 sorteado
  // (desce mais rápido na fase 2). Tiros a 6,5 um do outro: a nave (raio 1,5)
  // não passa entre dois (raio 2), só pelo vão.
  ondas: {
    dur: 2.4,
    every: 0.8,
    fire: (b, g) => {
      const gap = g.rng.range(24, g.W - 24);
      for (let x = 4; x <= g.W - 4; x += 6.5) if (Math.abs(x - gap) > 14) g.fire(x, b.y + 14, DOWN, b.phase === 2 ? 88 : 70, "bala");
    },
  },
  brasas: { dur: 2, every: 0.12, fire: (b, g) => g.fire(g.rng.range(8, g.W - 8), -4, DOWN + g.rng.range(-0.1, 0.1), 80, "bolha") },
  // fase 2: lança 3 dardos em mergulho de dentro da fornalha
  drones: {
    dur: 1.6,
    start: (b, g) => {
      for (const dx of [-30, 0, 30]) g.spawnEnemy("dardo", { x: b.x + dx, y: b.y + 8, move: "dive", yStop: b.y + 30, diveSpeed: 165 });
    },
  },
  rajada_fornalha: {
    dur: 1.6,
    every: 0.4,
    fire: (b, g) => fan(g, b.x, b.y + 16, 5, 0.2, 105, "bala", g.aimAngle(b.x, b.y + 16)),
  },

  // ----- Rainha -----
  // chama 8 Zangões em V (o teto de inimigos vale)
  enxame: {
    dur: 2,
    start: (b, g) => {
      for (const i of [-4, -3, -2, -1, 1, 2, 3, 4]) g.spawnEnemy("zangao", { x: b.x + i * 11, y: b.y + 14 - Math.abs(i) * 5, vy: 54 });
    },
  },
  ferroes: {
    dur: 1.6,
    every: 0.4,
    fire: (b, g) => fan(g, b.x, b.y + 16, 3, 0.12, 150, "agulha", g.aimAngle(b.x, b.y + 16)),
  },
  espinhos: { dur: 1.2, every: 0.6, fire: (b, g, i) => ring(g, b.x, b.y, 12, 60, "agulha", i * 0.26) },
  // fase 2: raio que varre ±0,9 rad em volta da nave, com 1 s de aviso
  raio_leque: {
    dur: 2.8,
    still: true,
    start: (b, g) => {
      const a = g.aimAngle(b.x, b.y + 2);
      g.laser(b, a - 0.9, a + 0.9, 1, 1.6, 6);
    },
  },
};

const SCRIPTS = {
  colosso: [
    ["leque", "gemeos", "leque", "pausa", "torretas", "pausa"],
    ["espiral", "leque7", "gemeos", "anel", "torretas"],
  ],
  aranha: [
    ["teia", "bote", "patas", "pausa", "bote", "pausa"],
    ["teia6", "chuva", "bote", "patas", "pausa"],
  ],
  olho: [
    ["olhar", "laser", "pausa", "orbes", "piscar", "pausa"],
    ["laser2", "orbes", "olhar", "piscar", "olhar"],
  ],
  serpente: [
    ["gomos", "pausa", "gomos", "pausa"],
    ["gomos", "anel_serpente", "gomos", "anel_serpente"],
  ],
  forja: [
    ["ondas", "brasas", "pausa", "ondas", "pausa"],
    ["ondas", "drones", "brasas", "ondas", "rajada_fornalha"],
  ],
  rainha: [
    ["ferroes", "enxame", "pausa", "ferroes", "espinhos", "pausa"],
    ["raio_leque", "enxame", "ferroes", "espinhos"],
  ],
};

// n: número do chefe na partida (0, 1, 2...): o rodízio e a força vêm daqui.
export function makeBoss(n, H, hpScale) {
  const def = BOSSES[n % BOSSES.length];
  const size = sizeOf(def.sprite);
  const lap = Math.floor(n / BOSSES.length);
  const lapBonus = 1 + 0.5 * lap;
  const hp = Math.round(def.hp * hpScale * lapBonus);
  const ty = Math.round(H * def.y + size.h / 2);
  return {
    def,
    id: def.id,
    name: def.name,
    w: size.w,
    h: size.h,
    box: def.box,
    x: W / 2,
    y: -size.h / 2,
    ty,
    hp,
    maxHp: hp,
    t: 0,
    phase: 1,
    flash: 0,
    entering: true,
    vulnerable: false,
    script: 0,
    attack: null,
    attackT: 0,
    shotI: 0,
    nextShot: 0,
    lid: 0,
    wander: null,
    damageTaken: false,
    lap,
    skin: lapSkin(lap), // paleta da volta (0 na primeira)
    broken: false, // armadura quebrada (fase 2)
    moveT: 0, // relógio do movimento (corre 1,5× na fase 2 da Serpente)
    // Serpente: gomos e o rastro da cabeça (mais novo primeiro)
    segments: def.segments ? Array.from({ length: def.segments }, () => ({ x: W / 2, y: -size.h / 2 })) : null,
    trail: [],
  };
}

// Sprite do chefe (ou de uma peça dele, como a íris): quebrado na fase 2 e
// na paleta da volta.
export const bossSprite = (b, part = b.def.sprite) => `${part}${b.broken ? "_quebrado" : ""}${b.skin ? `@${b.skin}` : ""}`;

// Atualiza movimento e ataques. Devolve "phase2" quando muda de fase.
export function updateBoss(b, dt, g) {
  b.t += dt;
  if (b.flash > 0) b.flash -= dt;
  if (b.flashCool > 0) b.flashCool -= dt;
  if (b.entering) {
    b.y += (b.ty - b.y) * Math.min(1, dt * 1.6);
    b.x += (g.W / 2 - b.x) * Math.min(1, dt * 2);
    if (Math.abs(b.ty - b.y) < 1.5) {
      b.entering = false;
      b.vulnerable = true;
      b.t = 0;
    }
    if (b.segments) followHead(b);
    return null;
  }
  move(b, dt, g);
  if (b.segments) followHead(b);

  let event = null;
  if (b.phase === 1 && b.hp < b.maxHp / 2) {
    b.phase = 2;
    b.broken = true;
    b.script = 0;
    b.attack = null;
    event = "phase2";
  }

  // fase 2 e setores avançados: disparos mais frequentes; da 2ª volta em
  // diante o chefe já começa no roteiro da fase 2
  const enraged = b.lap >= 1;
  const fast = (b.phase === 2 ? (enraged ? 0.65 : 0.8) : 1) / Math.sqrt(g.scale.fire);
  if (!b.attack || b.attackT >= b.attack.dur) {
    const list = SCRIPTS[b.id][enraged ? 1 : b.phase - 1];
    const name = list[b.script % list.length];
    b.script += 1;
    b.attack = ATTACKS[name];
    b.attackName = name;
    b.attackT = 0;
    b.shotI = 0;
    b.nextShot = 0.15;
    b.lid = b.attack.lid ?? 0;
    b.attack.start?.(b, g);
  }
  b.attackT += dt;
  // olho fechado: invulnerável
  b.vulnerable = b.lid !== 2;
  if (b.attack.every) {
    while (b.attackT >= b.nextShot && b.nextShot < b.attack.dur) {
      b.attack.fire(b, g, b.shotI++);
      b.nextShot += b.attack.every * fast;
    }
  }
  return event;
}

function move(b, dt, g) {
  if (b.attack?.still) return;
  const t = b.t;
  if (b.id === "colosso") {
    b.x = g.W / 2 + Math.sin(t * 0.5) * 52;
    b.y = b.ty + Math.sin(t * 0.9) * 3;
  } else if (b.id === "serpente") {
    b.moveT += dt * (b.phase === 2 ? 1.5 : 1);
    b.x = g.W / 2 + Math.sin(b.moveT * 0.9) * (g.W / 2 - 30);
    b.y = b.ty + Math.sin(b.moveT * 1.7) * 26;
  } else if (b.id === "forja") {
    // pesada: só balança ±30 de um lado para o outro
    b.x = g.W / 2 + Math.sin(t * 0.5) * 30;
    b.y = b.ty + Math.sin(t * 0.8) * 2;
  } else if (b.id === "rainha") {
    // voo em oito
    b.x = g.W / 2 + Math.sin(t * 0.7) * 50;
    b.y = b.ty + Math.sin(t * 1.4) * 12;
  } else if (b.id === "aranha") {
    if (!b.wander || t >= b.wander.until) {
      b.wander = { x: g.rng.range(44, g.W - 44), y: b.ty + g.rng.range(-8, 22), until: t + 2.4 };
    }
    b.x += (b.wander.x - b.x) * Math.min(1, dt * 1.3);
    b.y += (b.wander.y - b.y) * Math.min(1, dt * 1.3);
  } else {
    b.x = g.W / 2 + Math.sin(t * 0.6) * 44;
    b.y = b.ty + Math.sin(t * 1.2) * 10;
  }
}

// Gomos seguem o caminho da cabeça: cada um fica `spacing` adiante do outro
// ao longo do rastro (os que ainda não cabem esperam no começo dele).
function followHead(b) {
  const head = b.trail[0];
  if (!head || Math.hypot(b.x - head.x, b.y - head.y) >= 1) b.trail.unshift({ x: b.x, y: b.y });
  const pts = b.trail;
  const gap = b.def.spacing;
  let k = 0;
  let need = gap;
  // a cabeça pode estar a menos de 1 do ponto mais novo: o pedaço já conta
  let acc = Math.hypot(b.x - pts[0].x, b.y - pts[0].y);
  for (let i = 1; i < pts.length && k < b.segments.length; i++) {
    const a = pts[i - 1];
    const c = pts[i];
    const d = Math.hypot(c.x - a.x, c.y - a.y);
    while (k < b.segments.length && acc + d >= need) {
      const u = d > 0 ? (need - acc) / d : 0;
      b.segments[k].x = a.x + (c.x - a.x) * u;
      b.segments[k].y = a.y + (c.y - a.y) * u;
      k += 1;
      need += gap;
    }
    acc += d;
    if (k >= b.segments.length) pts.length = i + 1;
  }
  const end = pts[pts.length - 1];
  for (; k < b.segments.length; k++) {
    b.segments[k].x = end.x;
    b.segments[k].y = end.y;
  }
}

// Caixa de acerto do chefe (centrada).
export function bossHit(b, x, y, pad = 0) {
  return Math.abs(x - b.x) <= b.box[0] / 2 + pad && Math.abs(y - b.y) <= b.box[1] / 2 + pad;
}

// Acertou um gomo da Serpente (bloqueia o tiro, sem dano).
export function bossBlocks(b, x, y, pad = 0) {
  return !!b.segments?.some((s) => Math.abs(x - s.x) <= 7 + pad && Math.abs(y - s.y) <= 6 + pad);
}

export { ATTACKS, SCRIPTS };
