// Raridade das cápsulas: chance por origem, garantias contra azar e quantos
// níveis cada raridade dá. Os sorteios são só dentro do jogo (não há compra de
// item aleatório). Testado em tests/loot.test.js.
import { RARITIES, RARITY, LOOT, POWER, ROCKET_MARKS, DRONE_MARKS } from "./config.js";
import { gunForm, starsOf } from "./power.js";

export const newPity = () => ({ commons: 0, bossesNoLegend: 0 });

// Origem do loot de um inimigo abatido: Portador e Couraçado têm tabela
// própria (melhor que a de elite); os demais elites usam a de elite.
export const lootSource = (e) => (e.type === "portador" || e.type === "couracado" ? e.type : e.elite ? "elite" : "inimigo");

// Pesos [comum, rara, épica, lendária] da origem com a Sorte do hangar.
export function rarityWeights(source, luckLevel = 0) {
  const w = [...LOOT.sources[source]];
  const floor = w[0] > LOOT.minCommon ? LOOT.minCommon : 0;
  const common = Math.max(floor, w[0] - LOOT.luckShift * luckLevel);
  const moved = w[0] - common;
  const rest = w[1] + w[2] + w[3];
  if (moved > 0 && rest > 0) {
    for (let i = 1; i < 4; i++) w[i] += (moved * w[i]) / rest;
    w[0] = common;
  }
  return w;
}

// Sorteia a raridade com um rng.next() e atualiza as garantias em `pity`.
export function rollRarity(rng, source, pity, luckLevel = 0) {
  const w = rarityWeights(source, luckLevel);
  if (pity.commons >= LOOT.pityCommons) w[0] = 0;
  const u = rng.next();
  let rarity = null;
  if (source === "chefe1" && pity.bossesNoLegend >= LOOT.legendaryBosses - 1) rarity = "lendaria";
  else {
    const total = w.reduce((a, b) => a + b, 0);
    let acc = 0;
    for (let i = 0; i < w.length && !rarity; i++) {
      if (w[i] <= 0) continue;
      acc += w[i] / total;
      if (u < acc) rarity = RARITIES[i];
    }
    for (let i = w.length - 1; i >= 0 && !rarity; i--) if (w[i] > 0) rarity = RARITIES[i];
  }
  pity.commons = rarity === "comum" ? pity.commons + 1 : 0;
  if (source === "chefe1") pity.bossesNoLegend = rarity === "lendaria" ? 0 : pity.bossesNoLegend + 1;
  return rarity;
}

// Níveis que a cápsula de arma dá. Lendária: até o próximo marco (múltiplo
// de 5), no mínimo +3.
export function levelGain(rarity, weapon, level) {
  const r = RARITY[rarity];
  if (!r.toMilestone) return r.gain;
  return Math.max(r.minGain, (Math.floor(level / POWER.band) + 1) * POWER.band - level);
}

// Nome do marco cruzado ao subir a arma de `from` para `to` (forma nova,
// estrela da metralhadora ou marca de foguete/drone), ou null.
export function markCrossed(weapon, from, to) {
  if (to <= from) return null;
  if (weapon === "M") {
    if (gunForm(to).id !== gunForm(from).id) return gunForm(to).name;
    return starsOf(to) > starsOf(from) ? `★${starsOf(to)}` : null;
  }
  const marks = weapon === "F" ? ROCKET_MARKS : DRONE_MARKS;
  let name = null;
  for (const [at, label] of Object.entries(marks)) if (from < Number(at) && Number(at) <= to) name = label;
  return name;
}
