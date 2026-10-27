// Progresso entre partidas: cristais, hangar, naves, missões, patente e bônus
// diário. Funções puras (recebem o perfil e devolvem um perfil novo).
// Testado em tests/meta.test.js.
import {
  UPGRADES,
  UPGRADE_ORDER,
  SHIPS,
  SHIP_ORDER,
  RANKS,
  MISSIONS_PER_RANK,
  RANK_BONUS,
  RANK_BONUS_MAX,
} from "./config.js";
import { emptyStats, sanitizeStats, recordRun, isStruggling } from "./stats.js";
import { fillMissions, settleMissions, KINDS } from "./missions.js";

export const PROFILE_VERSION = 1;

export function defaultProfile() {
  return {
    v: PROFILE_VERSION,
    cristais: 0,
    upgrades: Object.fromEntries(UPGRADE_ORDER.map((k) => [k, 0])),
    ship: "faisca",
    ships: ["faisca"],
    missions: [],
    missionsDone: 0,
    stats: emptyStats(),
    settings: { sfx: true, music: true, vibration: true, analytics: false },
    dailyDay: null,
    tutorial: false,
    id: null,
  };
}

const int = (v, min, max) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

export function sanitizeProfile(raw) {
  const p = defaultProfile();
  if (!raw || typeof raw !== "object") return p;
  p.cristais = int(raw.cristais, 0, 1e9);
  if (raw.upgrades && typeof raw.upgrades === "object") {
    for (const k of UPGRADE_ORDER) p.upgrades[k] = int(raw.upgrades[k], 0, UPGRADES[k].costs.length);
  }
  if (Array.isArray(raw.ships)) p.ships = SHIP_ORDER.filter((id) => id === "faisca" || raw.ships.includes(id));
  p.ship = p.ships.includes(raw.ship) ? raw.ship : "faisca";
  if (Array.isArray(raw.missions)) {
    p.missions = raw.missions
      .filter((m) => m && KINDS[m.kind] && Number.isFinite(Number(m.n)))
      .filter((m) => (m.kind === "ship_run" ? SHIPS[m.type] : m.kind === "type_total" ? typeof m.type === "string" : true))
      .slice(0, 3)
      .map((m) => ({
        id: String(m.id ?? Math.random()),
        kind: m.kind,
        n: int(m.n, 1, 1e9),
        type: m.type,
        progress: int(m.progress, 0, 1e9),
        reward: int(m.reward ?? KINDS[m.kind].reward, 0, 1000),
      }));
  }
  p.missionsDone = int(raw.missionsDone, 0, 1e6);
  p.stats = sanitizeStats(raw.stats);
  const st = raw.settings ?? {};
  p.settings = {
    sfx: st.sfx !== false,
    music: st.music !== false,
    vibration: st.vibration !== false,
    analytics: st.analytics === true,
  };
  p.dailyDay = typeof raw.dailyDay === "string" ? raw.dailyDay : null;
  p.tutorial = raw.tutorial === true;
  p.id = typeof raw.id === "string" ? raw.id : null;
  return p;
}

// ---------- hangar ----------

export const upgradeCost = (key, level) => UPGRADES[key].costs[level] ?? null;

export function canBuy(profile, key) {
  const cost = upgradeCost(key, profile.upgrades[key]);
  return cost !== null && profile.cristais >= cost;
}

export function buyUpgrade(profile, key) {
  if (!canBuy(profile, key)) return { ok: false, profile };
  const cost = upgradeCost(key, profile.upgrades[key]);
  return {
    ok: true,
    profile: { ...profile, cristais: profile.cristais - cost, upgrades: { ...profile.upgrades, [key]: profile.upgrades[key] + 1 } },
  };
}

// Melhoria mais perto de caber no bolso (para a tela inicial dizer "faltam X").
export function nextUpgradeGoal(profile) {
  let best = null;
  for (const key of UPGRADE_ORDER) {
    const cost = upgradeCost(key, profile.upgrades[key]);
    if (cost === null) continue;
    if (!best || cost < best.cost) best = { key, cost, level: profile.upgrades[key] + 1, missing: Math.max(0, cost - profile.cristais) };
  }
  return best;
}

export const affordableCount = (profile) => UPGRADE_ORDER.filter((k) => canBuy(profile, k)).length;

// O que a nave leva para a partida: nave escolhida + melhorias.
export function loadoutFor(profile) {
  const ship = SHIPS[profile.ship] ?? SHIPS.faisca;
  const u = profile.upgrades;
  return {
    ship: SHIPS[profile.ship] ? profile.ship : "faisca",
    hp: ship.hp + u.casco,
    gun: ship.gun + u.canhao,
    rockets: ship.rockets + u.foguetes,
    drones: ship.drones,
    shield: u.escudo >= 1,
    shieldRegen: UPGRADES.escudo.regen[u.escudo],
    magnet: UPGRADES.ima.radius[u.ima],
    luck: UPGRADES.sorte.mult[u.sorte],
  };
}

// ---------- naves ----------

export function shipUnlockMet(id, profile) {
  const u = SHIPS[id].unlock;
  if (!u) return true;
  if (u.kind === "sector") return profile.stats.best.sector >= u.n;
  if (u.kind === "bosses") return profile.stats.bosses >= u.n;
  if (u.kind === "missions") return profile.missionsDone >= u.n;
  return false;
}

export function shipUnlockProgress(id, profile) {
  const u = SHIPS[id].unlock;
  if (!u) return 1;
  const have = u.kind === "sector" ? profile.stats.best.sector : u.kind === "bosses" ? profile.stats.bosses : profile.missionsDone;
  return Math.min(1, have / u.n);
}

// ---------- patente ----------

export function rankOf(missionsDone) {
  const index = Math.floor(missionsDone / MISSIONS_PER_RANK);
  const extra = index - (RANKS.length - 1);
  const name = extra > 0 ? `${RANKS.at(-1)} ${extra + 1}` : RANKS[index];
  return {
    index,
    name,
    progress: missionsDone % MISSIONS_PER_RANK,
    bonus: Math.min(RANK_BONUS_MAX, index * RANK_BONUS),
  };
}

// ---------- bônus diário ----------

export function localDay(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const dailyAvailable = (profile, today) => profile.dailyDay !== today;

// ---------- fim de partida ----------

// Junta tudo o que uma partida rende: cristais com bônus, recordes, missões,
// patente e naves novas. Devolve o perfil novo e o resumo para a tela final.
export function applyRun(profile, run, today, rng) {
  const before = profile;
  const rankBefore = rankOf(before.missionsDone);
  const daily = dailyAvailable(before, today);
  const base = run.crystals;
  const rankExtra = Math.round(base * rankBefore.bonus);
  const dailyExtra = daily ? base + rankExtra : 0;

  const stats = recordRun(before.stats, run, today);
  const { done, open } = settleMissions(before.missions, run);
  const missionCrystals = done.reduce((s, m) => s + m.reward, 0);
  const missionsDone = before.missionsDone + done.length;

  const draft = { ...before, stats, missionsDone };
  const newShips = SHIP_ORDER.filter((id) => !before.ships.includes(id) && shipUnlockMet(id, draft));
  const ships = [...before.ships, ...newShips];
  const missions = fillMissions(open, stats, ships, rng);
  const total = base + rankExtra + dailyExtra + missionCrystals;

  const next = {
    ...draft,
    ships,
    missions,
    cristais: before.cristais + total,
    dailyDay: daily ? today : before.dailyDay,
  };
  return {
    profile: next,
    reward: { base, rank: rankExtra, daily: dailyExtra, missions: missionCrystals, total },
    records: { score: run.score > before.stats.best.score && before.stats.runs > 0, sector: run.sector > before.stats.best.sector && before.stats.runs > 0 },
    previousBest: before.stats.best,
    completed: done,
    newShips,
    rankUp: rankOf(missionsDone).index > rankBefore.index ? rankOf(missionsDone) : null,
  };
}

// Prepara o perfil para jogar: missões preenchidas.
export function ensureMissions(profile, rng) {
  if (profile.missions.length >= 3) return profile;
  return { ...profile, missions: fillMissions(profile.missions, profile.stats, profile.ships, rng) };
}

export const struggling = (profile) => isStruggling(profile.stats);
