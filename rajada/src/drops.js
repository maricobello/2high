// Cápsulas: quando caem e de que tipo. A chance cresce com o tempo sem
// cápsula (garantia contra azar) e o tipo acompanha o que a nave precisa.
import { DROPS, RARITY } from "./config.js";
import { levelGain, markCrossed } from "./loot.js";

export const CAP_TYPES = ["M", "F", "D", "E", "H", "P"];
export const CAP_NAMES = { M: "Metralhadora", F: "Foguetes", D: "Drone", E: "Escudo", H: "Reparo", P: "Pulso" };

// Chance de um abate comum soltar cápsula.
export function killDropChance(sinceCap, luck = 1, early = 1) {
  return Math.min(DROPS.pityMax, DROPS.killBase + sinceCap * DROPS.pityPerSec) * luck * early;
}

// Pesos de cada tipo conforme o estado da nave (p) e da partida (ctx).
// ctx.t: tempo de partida; ctx.recover: { type, until }; ctx.stress: 0 a 1;
// ctx.cool: { H, E } instante até quando Reparo e Escudo ficam fora do sorteio.
export function capsuleWeights(p, ctx) {
  const w = {
    M: p.gun < 3 ? 3 : 2,
    F: p.rockets === 0 ? 2.5 : 2,
    D: ctx.t < 20 ? 0 : 1.5,
    E: p.shield ? 0.2 : 1.2 + (p.hp <= 1 ? 1 : 0),
    H: p.hp >= p.maxHp ? 0 : 0.8 + 3 * (1 - p.hp / p.maxHp),
    P: 0.35 + 1.5 * (ctx.stress ?? 0),
  };
  const rec = ctx.recover;
  if (rec && ctx.t < rec.until && w[rec.type] !== undefined) w[rec.type] *= 3;
  // Reparo e Escudo não vêm em sequência
  for (const k of ["H", "E"]) if (ctx.cool?.[k] > ctx.t) w[k] = 0;
  return w;
}

export function pickCapsule(rng, p, ctx) {
  return rng.weighted(capsuleWeights(p, ctx)) ?? "M";
}

const WEAPON_KEY = { M: "gun", F: "rockets", D: "drones" };

// Aplica a cápsula na nave. Arma: sobe o nível conforme a raridade. Suporte:
// aplica o que couber (casco ou escudo cheios não dão nada a mais) e os extras
// da raridade. Devolve o que mudou para a tela avisar: níveis ganhos por arma,
// o nível novo, o marco cruzado (form, e de qual arma) e o TURBO ganho
// (0, 20 ou "cheio"). O efeito do Pulso e do TURBO é aplicado pela partida.
export function applyCapsule(p, type, rarity = "comum") {
  const r = RARITY[rarity];
  const gained = {};
  let level = 1;
  let turbo = 0;
  const raise = (w, n) => {
    gained[w] = n;
    p[WEAPON_KEY[w]] += n;
  };
  if (WEAPON_KEY[type]) {
    raise(type, levelGain(rarity, type, p[WEAPON_KEY[type]]));
    level = p[WEAPON_KEY[type]];
  } else {
    if (type === "E") p.shield = true;
    if (type === "H") p.hp = Math.min(p.maxHp, p.hp + 1);
    if (type === "H") level = p.hp;
    if (r.all) for (const w of ["M", "F", "D"]) raise(w, r.all);
    turbo = r.turboFull ? "cheio" : r.turbo ?? 0;
  }
  let form = null;
  let formWeapon = null;
  for (const w of ["M", "F", "D"]) {
    if (form || !gained[w]) continue;
    const now = p[WEAPON_KEY[w]];
    form = markCrossed(w, now - gained[w], now);
    if (form) formWeapon = w;
  }
  return { gained, level, form, formWeapon, turbo };
}

// Ao levar dano, a arma de maior nível perde 1 nível (empate: M, F, D).
export function weaponToLose(p) {
  let best = null;
  let bestLevel = 0;
  for (const [type, level, has] of [["M", p.gun, p.gun > 1], ["F", p.rockets, p.rockets > 0], ["D", p.drones, p.drones > 0]]) {
    if (has && level > bestLevel) {
      best = type;
      bestLevel = level;
    }
  }
  return best;
}

export function loseWeapon(p, type) {
  if (type === "M") p.gun = Math.max(1, p.gun - 1);
  else if (type === "F") p.rockets = Math.max(0, p.rockets - 1);
  else if (type === "D") p.drones = Math.max(0, p.drones - 1);
}
