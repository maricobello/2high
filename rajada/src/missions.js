// Missões sob medida: sempre 3 ativas, com alvos tirados das partidas do
// próprio jogador (perto do percentil 65), então dá para cumprir em 1 a 3
// partidas. O que mais derruba o jogador e a arma que ele menos usa viram
// missões. Funções puras, testadas em tests/meta.test.js.
import { SHIPS, SHIP_ORDER } from "./config.js";
import { percentile, recentValues, topEnemyCause } from "./stats.js";
import { fmt } from "./format.js";

const PLURAL = {
  zangao: "zangões",
  dardo: "dardos",
  atirador: "atiradores",
  couracado: "couraçados",
  mina: "minas",
  pedra_g: "pedras grandes",
  pedra_m: "pedras",
  pedra_p: "pedras",
};

const nice = (v, step) => Math.max(step, Math.round(v / step) * step);
const p65 = (stats, key, fallback) => (stats.recent.length >= 3 ? percentile(recentValues(stats, key), 0.65) : fallback);

// scope "run": vale o melhor de uma partida; "total": soma entre partidas.
// reward: cristais ao cumprir.
export const KINDS = {
  kills_run: { scope: "run", reward: 40, value: (r) => r.kills, text: (m) => `Destrua ${m.n} inimigos em uma partida` },
  sector: { scope: "run", reward: 60, value: (r) => r.sector, text: (m) => `Chegue ao setor ${m.n}` },
  caps_run: { scope: "run", reward: 40, value: (r) => r.caps, text: (m) => `Pegue ${m.n} cápsulas em uma partida` },
  combo: { scope: "run", reward: 45, value: (r) => r.maxCombo, text: (m) => `Faça um combo ×${m.n}` },
  crystals_run: { scope: "run", reward: 40, value: (r) => r.crystals, text: (m) => `Junte ${m.n} cristais em uma partida` },
  rockets_run: {
    scope: "run", reward: 50,
    value: (r) => r.killsBy?.rockets ?? 0,
    text: (m) => `Destrua ${m.n} inimigos com foguetes em uma partida`,
  },
  grazes_run: { scope: "run", reward: 45, value: (r) => r.grazes, text: (m) => `Raspe em ${m.n} tiros inimigos em uma partida` },
  turbo_run: {
    scope: "run", reward: 45,
    value: (r) => r.turbos,
    text: (m) => `Ative o TURBO ${m.n} ${m.n === 1 ? "vez" : "vezes"} em uma partida`,
  },
  score_run: { scope: "run", reward: 50, value: (r) => r.score, text: (m) => `Faça ${fmt(m.n)} pontos em uma partida` },
  ship_run: { scope: "run", reward: 30, value: (r, m) => (r.ship === m.type ? 1 : 0), text: (m) => `Jogue uma partida com a ${SHIPS[m.type].name}` },
  nohit_boss: { scope: "run", reward: 100, value: (r) => (r.noHitBoss ? 1 : 0), text: () => "Derrote um chefe sem levar dano" },
  bosses_total: { scope: "total", reward: 70, value: (r) => r.bosses, text: (m) => `Derrote ${m.n} ${m.n === 1 ? "chefe" : "chefes"}` },
  type_total: { scope: "total", reward: 60, value: (r, m) => r.killsType?.[m.type] ?? 0, text: (m) => `Destrua ${m.n} ${PLURAL[m.type]}` },
  carriers_total: { scope: "total", reward: 50, value: (r) => r.carriers, text: (m) => `Destrua ${m.n} portadores` },
};

export const missionText = (m) => KINDS[m.kind].text(m);

// Opções de missão para este jogador, com peso e alvo. owned: naves liberadas.
export function missionOptions(stats, owned = ["faisca"]) {
  const o = [];
  const add = (kind, weight, n, extra = {}) => o.push({ kind, weight, n: Math.max(1, Math.round(n)), ...extra });
  add("kills_run", 3, nice(Math.max(20, p65(stats, "kills", 20) * 1.1), 5));
  add("sector", stats.best.sector >= 1 ? 2 : 1, Math.max(2, stats.best.sector + 1));
  add("caps_run", 2, Math.max(3, Math.round(p65(stats, "caps", 2)) + 1));
  if (stats.best.combo < 8) add("combo", 1.5, Math.min(8, Math.max(2, Math.round(p65(stats, "combo", 1)) + 1)));
  add("crystals_run", 2, nice(Math.max(15, p65(stats, "crystals", 12) * 1.15), 5));
  const share = stats.kills ? (stats.killsBy.rockets ?? 0) / stats.kills : 0;
  add("rockets_run", stats.runs >= 3 && share < 0.15 ? 5 : 1.5, nice(Math.max(8, p65(stats, "rockets", 6) * 1.2), 2));
  add("grazes_run", 1.5, Math.max(5, Math.round(p65(stats, "grazes", 4) * 1.2)));
  add("turbo_run", 1.5, Math.max(1, Math.round(p65(stats, "turbos", 0)) + 1));
  add("score_run", 1.5, nice(Math.max(2000, p65(stats, "score", 1500) * 1.15), 500));
  if (stats.bosses >= 1) add("bosses_total", 1.5, stats.bosses >= 6 ? 3 : 2);
  const cause = topEnemyCause(stats);
  if (cause) add("type_total", 3, nice(cause === "couracado" ? 4 : cause === "atirador" ? 12 : 25, cause === "couracado" ? 1 : 2), { type: cause });
  add("carriers_total", 1.2, 3);
  const unused = SHIP_ORDER.find((id) => owned.includes(id) && id !== "faisca" && !(stats.shipRuns[id] > 0));
  if (unused) add("ship_run", 4, 1, { type: unused });
  if (stats.bosses >= 2) add("nohit_boss", 1, 1);
  return o;
}

let seq = 0;
const newId = (rng) => `m${Date.now().toString(36)}${(seq++).toString(36)}${Math.floor(rng.next() * 1e6).toString(36)}`;

// Completa até 3 missões, sem repetir tipo das que já estão ativas.
export function fillMissions(active, stats, owned, rng) {
  const list = [...active];
  while (list.length < 3) {
    const taken = new Set(list.map((m) => m.kind));
    const options = missionOptions(stats, owned).filter((o) => !taken.has(o.kind));
    if (!options.length) break;
    const weights = Object.fromEntries(options.map((op, i) => [i, op.weight]));
    const pick = options[Number(rng.weighted(weights))];
    list.push({ id: newId(rng), kind: pick.kind, n: pick.n, type: pick.type, progress: 0, reward: KINDS[pick.kind].reward });
  }
  return list;
}

// Progresso ao vivo (durante a partida): base guardada + o que a partida já fez.
export function liveProgress(m, run) {
  const k = KINDS[m.kind];
  const v = k.value(run, m);
  return k.scope === "total" ? m.progress + v : Math.max(m.progress, v);
}

export const isDone = (m, run) => liveProgress(m, run) >= m.n;

// Fecha a partida: atualiza progresso e separa as missões cumpridas.
export function settleMissions(missions, run) {
  const done = [];
  const open = [];
  for (const m of missions) {
    const progress = Math.min(m.n, liveProgress(m, run));
    const next = { ...m, progress };
    if (progress >= m.n) done.push(next);
    else open.push(next);
  }
  return { done, open };
}
