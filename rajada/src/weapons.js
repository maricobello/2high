// Armas da nave: padrões de tiro por nível e a curva dos foguetes.
// Funções puras: recebem números, devolvem tiros. Testado em tests/weapons.test.js.
import { GUN, ROCKETS, DRONES, TURBO } from "./config.js";

const RAD = Math.PI / 180;
export const GUN_MAX = GUN.levels.length;
export const ROCKETS_MAX = ROCKETS.levels.length - 1;
export const DRONES_MAX = DRONES.max;

const gunLevel = (level) => GUN.levels[Math.min(GUN_MAX, Math.max(1, level)) - 1];

// Uma rajada da metralhadora saindo de (x, y).
export function gunVolley(level, x, y) {
  const L = gunLevel(level);
  return L.streams.map(([dx, deg]) => ({
    x: x + dx,
    y,
    vx: Math.sin(deg * RAD) * GUN.speed,
    vy: -Math.cos(deg * RAD) * GUN.speed,
    dmg: L.dmg,
    big: !!L.big,
  }));
}

export function gunInterval(level, turbo = false) {
  return gunLevel(level).every * (turbo ? TURBO.fireMult : 1);
}

export function rocketSpec(level, turbo = false) {
  const spec = ROCKETS.levels[Math.min(ROCKETS_MAX, Math.max(0, level))];
  return spec && { ...spec, every: spec.every * (turbo ? TURBO.fireMult : 1) };
}

// Foguetes saem das asas, alternando lados; com 4 por salva, dois de cada lado.
export function rocketLaunch(level, x, y) {
  const spec = rocketSpec(level);
  if (!spec) return [];
  const out = [];
  for (let i = 0; i < spec.count; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const row = Math.floor(i / 2);
    out.push({
      x: x + side * (6 + row * 3),
      y: y + 4 + row * 3,
      angle: -Math.PI / 2 + side * (0.5 + row * 0.25),
      speed: ROCKETS.startSpeed,
      life: ROCKETS.life,
      target: null,
    });
  }
  return out;
}

// Vira o foguete na direção do alvo (no máximo `turn` rad/s) e acelera.
export function steerRocket(r, target, dt) {
  if (target) {
    const want = Math.atan2(target.y - r.y, target.x - r.x);
    let diff = want - r.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const maxTurn = ROCKETS.turn * dt;
    r.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
  }
  r.speed = Math.min(ROCKETS.maxSpeed, r.speed + ROCKETS.accel * dt);
  r.x += Math.cos(r.angle) * r.speed * dt;
  r.y += Math.sin(r.angle) * r.speed * dt;
  r.life -= dt;
}

// Alvo mais próximo à frente do foguete (prefere quem está acima dele).
export function pickTarget(r, enemies, boss) {
  let best = null;
  let bestScore = Infinity;
  for (const e of enemies) {
    if (e.hp <= 0 || e.y < -8) continue;
    const d = Math.hypot(e.x - r.x, e.y - r.y) + (e.y > r.y ? 150 : 0);
    if (d < bestScore) {
      bestScore = d;
      best = e;
    }
  }
  if (boss && boss.hp > 0 && boss.vulnerable) {
    const d = Math.hypot(boss.x - r.x, boss.y - r.y) * 0.8;
    if (d < bestScore) best = boss;
  }
  return best;
}

export function droneVolley(gunLevelNow, x, y) {
  if (gunLevelNow >= 4) {
    return [-6, 6].map((deg) => ({
      x,
      y,
      vx: Math.sin(deg * RAD) * GUN.speed,
      vy: -Math.cos(deg * RAD) * GUN.speed,
      dmg: DRONES.dmg,
      drone: true,
    }));
  }
  return [{ x, y, vx: 0, vy: -GUN.speed, dmg: DRONES.dmg, drone: true }];
}
