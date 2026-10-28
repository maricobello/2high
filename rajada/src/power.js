// Matemática do poder sem teto: faixa de cor, estrelas, dano e forma da
// metralhadora a partir do nível. Funções puras, usadas pela partida, pelo
// desenho e pelo placar.
import { POWER, GUN_FORMS } from "./config.js";

// Arco-íris (faixa 10): amarelo, laranja, vermelho, violeta, azul e verde,
// trocando de rampa a cada 0,1 s (só o matiz muda, o brilho fica parecido).
const RAINBOW = [1, 2, 3, 5, 6, 8];
const RAINBOW_STEP = 0.1;

export const bandOf = (level) => Math.min(POWER.rainbowBand, Math.floor(level / POWER.band));

export const starsOf = (level) =>
  level >= POWER.starFrom ? Math.floor((level - POWER.starFrom) / POWER.starEvery) + 1 : 0;

export const damageMult = (level) =>
  (1 + POWER.perLevel * (level - 1)) * (1 + POWER.starBonus * starsOf(level));

export function gunForm(level) {
  let form = GUN_FORMS[0];
  for (const f of GUN_FORMS) if (f.at <= level) form = f;
  return form;
}

// Próximo múltiplo de 5: nome da forma nova até o 30, depois a próxima ★.
export function nextMilestone(level) {
  const at = (Math.floor(level / POWER.band) + 1) * POWER.band;
  const label = at < POWER.starFrom ? gunForm(at).name : `★${starsOf(at)}`;
  return { at, label, missing: at - level };
}

export const weaponLabel = (level) => (starsOf(level) ? `${level}★${starsOf(level)}` : `${level}`);

// [claro, médio, escuro] da faixa; t em segundos só importa no arco-íris.
export function rampOf(band, t = 0) {
  if (band < POWER.rainbowBand) return POWER.ramps[Math.max(0, band)];
  return POWER.ramps[RAINBOW[Math.floor(t / RAINBOW_STEP + 1e-6) % RAINBOW.length]];
}
