// Armas da nave, sem nível máximo: padrões de tiro por nível e a curva dos
// foguetes. O dano cresce a cada nível (power.js); o que tem teto é só a
// quantidade na tela (9 canos, 8 foguetes, 4 drones).
// Funções puras: recebem números, devolvem tiros. Testado em tests/weapons.test.js.
import { GUN, ROCKETS, DRONES, TURBO } from "./config.js";
import { bandOf, damageMult, gunForm } from "./power.js";

const RAD = Math.PI / 180;
const fire = (turbo) => (turbo ? TURBO.fireMult : 1);

function gunPattern(level) {
  const pat = GUN.patterns[gunForm(level).id];
  if (!pat.byLevel) return pat;
  return { ...pat, streams: pat.byLevel[Math.min(pat.byLevel.length, Math.max(1, level)) - 1] };
}

// Uma rajada da metralhadora saindo de (x, y). volley: contador de rajadas
// (a Tempestade balança o leque para um lado nas pares e para o outro nas ímpares).
export function gunVolley(level, x, y, volley = 0) {
  const pat = gunPattern(level);
  const dmg = (pat.big ? GUN.bigMult : 1) * damageMult(Math.max(1, level));
  const band = bandOf(level);
  const sway = pat.sway ? (volley % 2 === 0 ? pat.sway : -pat.sway) : 0;
  const n = pat.streams.length;
  return pat.streams.map(([dx, deg], i) => {
    const a = (deg + sway) * RAD;
    const homing = !!pat.homing && i >= n - 2;
    const b = { x: x + dx, y, vx: Math.sin(a) * GUN.speed, vy: -Math.cos(a) * GUN.speed, dmg, big: !!pat.big, pierce: pat.pierce ?? 0, homing, band };
    if (homing) b.life = GUN.homingLife;
    return b;
  });
}

export function gunInterval(level, turbo = false) {
  const k = (Math.min(GUN.fastAt, Math.max(1, level)) - 1) / (GUN.fastAt - 1);
  return (GUN.every + (GUN.fastest - GUN.every) * k) * fire(turbo);
}

// Feixe contínuo do cano do meio (Raio em diante): dano a cada tique.
export function gunBeam(level) {
  if (!gunPattern(level).beam) return null;
  const { width, tick, mult } = GUN.beam;
  return { width, tick, dmg: mult * damageMult(level), band: bandOf(level) };
}

export function rocketSpec(level, turbo = false) {
  if (level < 1) return null;
  let step = ROCKETS.steps[0];
  for (const s of ROCKETS.steps) if (s.from <= level) step = s;
  const grow = Math.min(ROCKETS.splashMax, 1 + ROCKETS.splashGrow * Math.floor(Math.max(0, level - ROCKETS.fragFrom) / 5));
  return {
    every: step.every * fire(turbo),
    count: step.count,
    dmg: ROCKETS.dmg * damageMult(level),
    splash: ROCKETS.splash * grow,
    splashDmg: ROCKETS.splashDmg * damageMult(level),
    frag: level >= ROCKETS.fragFrom ? ROCKETS.frag : 0,
    band: bandOf(level),
  };
}

// Foguetes saem das asas, alternando lados, em pares cada vez mais abertos.
// Cada foguete leva o dano e a explosão do nível em que saiu.
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
      dmg: spec.dmg,
      splash: spec.splash,
      splashDmg: spec.splashDmg,
      frag: spec.frag,
      band: spec.band,
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

export function droneSpec(level) {
  const speed = Math.min(DRONES.speedMax, 1 + DRONES.speedUp * Math.max(0, level - DRONES.max));
  return {
    count: Math.max(0, Math.min(level, DRONES.max)),
    every: DRONES.every / speed,
    dmg: DRONES.dmg * damageMult(Math.max(1, level)),
    beam: level >= DRONES.beam.from,
    band: bandOf(level),
  };
}

// Tiros de um drone: 1 até o nível 4, 2 em leque de ±6° do 5 ao 9; com o
// raio (10 em diante) o drone não atira, o raio é tratado pela partida.
export function droneVolley(level, x, y) {
  const spec = droneSpec(level);
  if (spec.beam) return [];
  const angles = level >= DRONES.fanFrom ? [-6, 6] : [0];
  return angles.map((deg) => ({
    x,
    y,
    vx: Math.sin(deg * RAD) * GUN.speed,
    vy: -Math.cos(deg * RAD) * GUN.speed,
    dmg: spec.dmg,
    big: false,
    pierce: 0,
    homing: false,
    band: spec.band,
    drone: true,
  }));
}

// Dano por segundo da nave contra um alvo só (sem contar explosões e
// estilhaços): metralhadora, raio, foguetes e drones.
export function estimateDps(p) {
  let dps = gunVolley(p.gun, 0, 0).reduce((sum, b) => sum + b.dmg, 0) / gunInterval(p.gun);
  const beam = gunBeam(p.gun);
  if (beam) dps += beam.dmg / beam.tick;
  const rockets = rocketSpec(p.rockets);
  if (rockets) dps += (rockets.count * rockets.dmg) / rockets.every;
  const drones = droneSpec(p.drones);
  if (drones.count) {
    const each = drones.beam
      ? (DRONES.beam.mult * drones.dmg) / DRONES.beam.tick
      : (droneVolley(p.drones, 0, 0).length * drones.dmg) / drones.every;
    dps += drones.count * each;
  }
  return dps;
}
