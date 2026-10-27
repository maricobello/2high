// Estatísticas do jogador, guardadas no aparelho. São a base do ajuste de
// dificuldade, das missões sob medida e do "Registro de voo".
// Funções puras: recebem dados, devolvem dados novos. Testado em tests/meta.test.js.
import { clamp } from "./rng.js";

export const RECENT = 20;

export function emptyStats() {
  return {
    runs: 0,
    playTime: 0,
    kills: 0,
    bosses: 0,
    crystals: 0,
    caps: 0,
    grazes: 0,
    carriers: 0,
    turbos: 0,
    killsBy: { gun: 0, rockets: 0, drones: 0, pulse: 0, crash: 0 },
    killsType: {},
    causes: {},
    shipRuns: {},
    best: { score: 0, sector: 0, combo: 1, kills: 0, crystals: 0, dur: 0 },
    recent: [],
    skill: 0.3,
    beforeBoss: 0,
    days: 0,
    lastDay: null,
  };
}

const num = (v, min = 0) => (Number.isFinite(Number(v)) ? Math.max(min, Number(v)) : min);
const counts = (o) => {
  const out = {};
  if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) if (Number.isFinite(Number(v))) out[k] = Math.max(0, Number(v));
  return out;
};

export function sanitizeStats(raw) {
  const s = emptyStats();
  if (!raw || typeof raw !== "object") return s;
  for (const k of ["runs", "playTime", "kills", "bosses", "crystals", "caps", "grazes", "carriers", "turbos", "beforeBoss", "days"]) {
    s[k] = num(raw[k]);
  }
  s.killsBy = { ...s.killsBy, ...counts(raw.killsBy) };
  s.killsType = counts(raw.killsType);
  s.causes = counts(raw.causes);
  s.shipRuns = counts(raw.shipRuns);
  if (raw.best && typeof raw.best === "object") {
    for (const k of Object.keys(s.best)) s.best[k] = num(raw.best[k], k === "combo" ? 1 : 0);
  }
  if (Array.isArray(raw.recent)) {
    s.recent = raw.recent
      .filter((r) => r && typeof r === "object")
      .slice(-RECENT)
      .map((r) => ({
        score: num(r.score),
        sector: num(r.sector, 1),
        kills: num(r.kills),
        caps: num(r.caps),
        crystals: num(r.crystals),
        combo: num(r.combo, 1),
        grazes: num(r.grazes),
        dur: num(r.dur),
        rockets: num(r.rockets),
        turbos: num(r.turbos),
      }));
  }
  s.skill = clamp(Number.isFinite(Number(raw.skill)) ? Number(raw.skill) : 0.3, 0, 1);
  s.lastDay = typeof raw.lastDay === "string" ? raw.lastDay : null;
  return s;
}

// Desempenho de uma partida, de 0 a 1 (setor alcançado pesa mais que tempo).
export function performance(run) {
  return clamp((run.sector - 1) / 5 + Math.min(run.dur, 600) / 1500 + (run.bosses ? 0.05 : 0), 0, 1);
}

export function recordRun(stats, run, today) {
  const s = sanitizeStats(stats);
  s.runs += 1;
  s.playTime += run.dur;
  s.kills += run.kills;
  s.bosses += run.bosses;
  s.crystals += run.crystals;
  s.caps += run.caps;
  s.grazes += run.grazes;
  s.carriers += run.carriers;
  s.turbos += run.turbos;
  for (const [k, v] of Object.entries(run.killsBy ?? {})) s.killsBy[k] = (s.killsBy[k] ?? 0) + v;
  for (const [k, v] of Object.entries(run.killsType ?? {})) s.killsType[k] = (s.killsType[k] ?? 0) + v;
  if (run.cause) s.causes[run.cause] = (s.causes[run.cause] ?? 0) + 1;
  s.shipRuns[run.ship] = (s.shipRuns[run.ship] ?? 0) + 1;
  s.best = {
    score: Math.max(s.best.score, run.score),
    sector: Math.max(s.best.sector, run.sector),
    combo: Math.max(s.best.combo, run.maxCombo),
    kills: Math.max(s.best.kills, run.kills),
    crystals: Math.max(s.best.crystals, run.crystals),
    dur: Math.max(s.best.dur, run.dur),
  };
  s.recent = [
    ...s.recent,
    {
      score: run.score,
      sector: run.sector,
      kills: run.kills,
      caps: run.caps,
      crystals: run.crystals,
      combo: run.maxCombo,
      grazes: run.grazes,
      dur: Math.round(run.dur),
      rockets: run.killsBy?.rockets ?? 0,
      turbos: run.turbos,
    },
  ].slice(-RECENT);
  // média móvel: cada partida pesa 25% na habilidade estimada
  s.skill = clamp(s.skill * 0.75 + performance(run) * 0.25, 0, 1);
  s.beforeBoss = run.bosses > 0 ? 0 : s.beforeBoss + 1;
  if (today && s.lastDay !== today) {
    s.days += 1;
    s.lastDay = today;
  }
  return s;
}

export function percentile(values, q) {
  if (!values.length) return 0;
  const v = [...values].sort((a, b) => a - b);
  const pos = (v.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return v[lo] + (v[hi] - v[lo]) * (pos - lo);
}

export const recentValues = (stats, key) => stats.recent.map((r) => r[key]);

// Caiu antes do primeiro chefe nas 3 últimas partidas: o jogo dá uma folga.
export const isStruggling = (stats) => stats.beforeBoss >= 3;

const ENEMY_CAUSES = ["zangao", "dardo", "atirador", "couracado", "mina", "pedra_g", "pedra_m", "pedra_p"];

// Inimigo que mais derrubou o jogador (só inimigos comuns, não chefes).
export function topEnemyCause(stats) {
  let best = null;
  let n = 0;
  for (const k of ENEMY_CAUSES) {
    const v = stats.causes[k] ?? 0;
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return n >= 2 ? best : null;
}

export function favoriteWeapon(stats) {
  const k = stats.killsBy;
  const list = [
    ["Metralhadora", k.gun ?? 0],
    ["Foguetes", k.rockets ?? 0],
    ["Drones", k.drones ?? 0],
  ].sort((a, b) => b[1] - a[1]);
  return list[0][1] > 0 ? list[0][0] : "—";
}
