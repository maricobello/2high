// Cápsulas: quando caem e de que tipo. A chance cresce com o tempo sem
// cápsula (garantia contra azar) e o tipo acompanha o que a nave precisa.
import { DROPS } from "./config.js";
import { GUN_MAX, ROCKETS_MAX, DRONES_MAX } from "./weapons.js";

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
    M: p.gun < 3 ? 3 : p.gun < GUN_MAX ? 2 : 0.4,
    F: p.rockets === 0 ? 2.5 : p.rockets < ROCKETS_MAX ? 2 : 0.4,
    D: ctx.t < 20 ? 0 : p.drones < DRONES_MAX ? 1.5 : 0.3,
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

// Aplica a cápsula na nave. Devolve o que mudou para a tela avisar.
// max: a arma já estava no máximo (vira bônus de pontos e cristais).
export function applyCapsule(p, type) {
  switch (type) {
    case "M":
      if (p.gun >= GUN_MAX) return { max: true };
      p.gun += 1;
      return { level: p.gun, max: false, full: p.gun === GUN_MAX };
    case "F":
      if (p.rockets >= ROCKETS_MAX) return { max: true };
      p.rockets += 1;
      return { level: p.rockets, max: false, full: p.rockets === ROCKETS_MAX };
    case "D":
      if (p.drones >= DRONES_MAX) return { max: true };
      p.drones += 1;
      return { level: p.drones, max: false, full: p.drones === DRONES_MAX };
    case "E":
      if (p.shield) return { max: true };
      p.shield = true;
      return { level: 1, max: false };
    case "H":
      if (p.hp >= p.maxHp) return { max: true };
      p.hp += 1;
      return { level: p.hp, max: false };
    default:
      return { level: 1, max: false }; // Pulso: o efeito é aplicado pela partida
  }
}

// Ao levar dano, a arma mais forte (em proporção ao máximo) perde 1 nível.
export function weaponToLose(p) {
  const options = [
    ["M", p.gun > 1 ? p.gun / GUN_MAX : -1],
    ["F", p.rockets > 0 ? p.rockets / ROCKETS_MAX : -1],
    ["D", p.drones > 0 ? p.drones / DRONES_MAX : -1],
  ].filter(([, v]) => v > 0);
  if (!options.length) return null;
  options.sort((a, b) => b[1] - a[1]);
  return options[0][0];
}

export function loseWeapon(p, type) {
  if (type === "M") p.gun = Math.max(1, p.gun - 1);
  else if (type === "F") p.rockets = Math.max(0, p.rockets - 1);
  else if (type === "D") p.drones = Math.max(0, p.drones - 1);
}
