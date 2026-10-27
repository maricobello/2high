// Estado de uma partida e sua atualização a cada quadro. Não desenha nem toca som:
// avisa o que aconteceu por onEvent(tipo, dados) e o resto do app reage.
import { placeBlock, grownWidth, sliderPosition, starsFor, endlessRules } from "./core.js";

export const BASE_W = 200;
export const BLOCK_H = 30;
export const RANGE = 175;
const GROW_STEP = 12;
const GRAVITY = 1500;
const LOST_DELAY = 0.75;
const NEAR_MISS = 0.25;

// mode: "phase" (meta de altura), "endless" (até errar) ou "demo" (fundo da tela inicial).
export function createGame({ mode, phase, best = 0, onEvent = () => {}, random = Math.random }) {
  const startW = BASE_W * (mode === "endless" ? 1 : phase.startWidth);
  const g = {
    mode,
    phase,
    best,
    target: mode === "phase" ? phase.target : 0,
    rules: mode === "endless" ? endlessRules(0) : phase,
    blocks: [{ x: 0, w: startW }],
    moving: null,
    debris: [],
    effects: [],
    combo: 0,
    perfects: 0,
    height: 0,
    stars: 0,
    status: "playing",
    t: 0,
    endT: 0,
    swayX: 0,
    shake: 0,
  };

  const top = () => g.blocks[g.blocks.length - 1];

  function spawn() {
    const jitter = g.rules.jitter ? (random() * 2 - 1) * g.rules.jitter : 0;
    const dir = g.height % 2 === 0 ? 1 : -1;
    g.moving = { x: top().x - dir * RANGE, w: top().w, p: 0, dir, mul: 1 + jitter };
  }

  function addText(text, y, kind) {
    g.effects.push({ type: "text", text, kind, x: top().x, y, t: 0, dur: 0.9 });
  }

  // Distância entre o centro do bloco em movimento e o centro da torre (com o balanço).
  g.offset = () => (g.moving ? g.moving.x - g.swayX - top().x : 0);

  g.drop = () => {
    if (g.status !== "playing" || !g.moving) return false;
    const m = g.moving;
    const below = top();
    const y = g.height * BLOCK_H;
    const r = placeBlock(below, { x: m.x - g.swayX, w: m.w }, g.rules.tolerance);
    g.moving = null;

    if (r.kind === "miss") {
      g.combo = 0;
      g.debris.push(makeDebris(m.x, y, m.w, m.dir, g.height + 1, random));
      g.status = "falling";
      g.shake = 10;
      onEvent("miss", {});
      return true;
    }

    let event;
    if (r.kind === "perfect") {
      g.combo += 1;
      g.perfects += 1;
      const w = grownWidth(r.block.w, g.combo, startW, GROW_STEP);
      g.blocks.push({ x: r.block.x, w });
      g.effects.push({ type: "ring", x: r.block.x, y, w, t: 0, dur: 0.55 });
      addText(g.combo > 1 ? `Perfeito ×${g.combo}` : "Perfeito", y, "perfect");
      event = ["perfect", { combo: g.combo, grew: w > r.block.w }];
    } else {
      g.combo = 0;
      g.blocks.push(r.block);
      const side = Math.sign(m.x - g.swayX - below.x);
      g.debris.push(makeDebris(r.debris.x + g.swayX, y, r.debris.w, side, g.height + 1, random));
      g.shake = 3;
      if (r.kept < NEAR_MISS) addText("Por pouco", y, "near");
      event = ["cut", { kept: r.kept }];
    }

    // o evento sai com a altura já contada, para a tela mostrar o número certo
    g.height += 1;
    if (g.mode === "endless") g.rules = endlessRules(g.height);
    onEvent(...event);
    if (g.mode === "phase" && g.height >= g.target) {
      g.status = "won";
      g.stars = starsFor(g.perfects, g.target);
      onEvent("won", { stars: g.stars, perfects: g.perfects, height: g.height });
    } else {
      spawn();
    }
    return true;
  };

  g.update = (dt) => {
    g.t += dt;
    g.swayX = g.rules.sway ? g.rules.sway * Math.sin(g.t * 1.4) : 0;
    const m = g.moving;
    if (m) {
      m.p += (g.rules.speed * m.mul * dt) / (4 * RANGE);
      m.x = top().x + m.dir * sliderPosition(m.p, RANGE, g.rules.easing);
    }
    for (const d of g.debris) {
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.rot += d.vr * dt;
    }
    g.debris = g.debris.filter((d) => d.y > g.height * BLOCK_H - 1400);
    for (const e of g.effects) e.t += dt;
    g.effects = g.effects.filter((e) => e.t < e.dur);
    g.shake = Math.max(0, g.shake - dt * 40);

    if (g.status === "falling" || g.status === "won") g.endT += dt;
    if (g.status === "falling" && g.endT >= LOST_DELAY) {
      g.status = "lost";
      onEvent("lost", {
        height: g.height,
        remaining: Math.max(0, g.target - g.height),
        best: g.best,
      });
    }
  };

  spawn();
  return g;
}

// i é o índice do bloco de origem, para manter a cor ao cair.
function makeDebris(x, y, w, side, i, random) {
  return {
    i,
    x,
    y,
    w,
    vx: side * (60 + random() * 60),
    vy: 120,
    rot: 0,
    vr: side * (1.5 + random() * 2),
  };
}
