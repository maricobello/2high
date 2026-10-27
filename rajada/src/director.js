// O Diretor decide o ritmo das ondas: ciclo de tensão (sobe, pico, alívio),
// misericórdia depois de dano e um ajuste leve pela habilidade do jogador.
// Funções puras, testadas em tests/director.test.js.
import { DIRECTOR, WAVES, sectorScale, sectorInfo } from "./config.js";
import { clamp } from "./rng.js";

export function cycleLength() {
  return DIRECTOR.cycle.reduce((a, b) => a + b, 0);
}

// Tensão de 0 a 1 no instante t do setor.
export function tension(t) {
  const [up, peak] = DIRECTOR.cycle;
  const u = t % cycleLength();
  if (u < up) return DIRECTOR.floor + (1 - DIRECTOR.floor) * (u / up);
  if (u < up + peak) return 1;
  return DIRECTOR.relax;
}

// Habilidade estimada (0 a 1) vira ajustes pequenos (no máximo ±15%).
// struggling: caiu antes do primeiro chefe nas últimas partidas.
export function skillAdjust(skill, struggling = false) {
  const s = clamp(Number.isFinite(skill) ? skill : 0.3, 0, 1);
  return {
    pressure: (0.85 + 0.3 * s) * (struggling ? 0.9 : 1),
    shotSpeed: 0.9 + 0.2 * s,
    earlyDrops: struggling ? 1.6 : 1 + (1 - s) * 0.5,
  };
}

// Ameaça máxima que pode estar viva agora.
// strong: armas fortes; sinceHit: segundos sem levar dano.
export function threatCap({ sector, t, adjust, hp, sinceHit, strong }) {
  let cap = sectorScale(sector).cap * tension(t) * adjust.pressure;
  if (hp <= 1) cap *= DIRECTOR.lowHpCap;
  else if (strong && sinceHit > DIRECTOR.pressureAfter) cap *= DIRECTOR.pressureCap;
  return cap;
}

// Próxima onda que cabe na folga (room) de ameaça; null se nenhuma couber.
export function pickWave(rng, { sector, t, room, last }) {
  const rocks = sectorInfo(sector).rocks;
  const options = {};
  for (const w of WAVES) {
    if (w.min > sector || (w.after && t < w.after) || w.threat > room) continue;
    let weight = w.weight;
    if (w.id === last) weight *= 0.3;
    if (w.id === "pedras" && rocks) weight *= 3;
    options[w.id] = weight;
  }
  return rng.weighted(options);
}

export function waveThreat(id) {
  return WAVES.find((w) => w.id === id)?.threat ?? 0;
}

// Intervalo até tentar a próxima onda: menor na tensão alta.
export function waveGap(rng, sector, t) {
  return (sectorScale(sector).gap * rng.range(0.8, 1.2)) / (0.6 + 0.4 * tension(t));
}
