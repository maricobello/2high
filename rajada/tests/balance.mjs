// Simulador de balanceamento: pilotos automáticos de três níveis jogam
// dezenas de partidas sem tela. Mostra duração, setor, cristais, cápsulas e
// o que mais derruba. Uso: npm run balance [-- partidas]
import { createGame, DEFAULT_LOADOUT } from "../src/game.js";
import { createBot } from "../src/bot.js";
import { percentile } from "../src/stats.js";

const RUNS = Number(process.argv[2] ?? 30);
const DT = 1 / 60;
const LIMIT = 15 * 60; // s

function simulate(skill, seed, loadout = DEFAULT_LOADOUT, gameSkill = 0.3) {
  let over = null;
  const g = createGame({ seed, skill: gameSkill, loadout, onEvent: (t, d) => t === "over" && (over = d) });
  const bot = createBot({ skill, seed: seed * 7 + 1 });
  while (!over && g.t < LIMIT) {
    bot.drive(g, DT);
    g.update(DT);
  }
  return over ?? { ...g.summary(), timeout: true };
}

const fmt = (v, d = 0) => v.toFixed(d).padStart(6);
const row = (label, runs) => {
  const q = (k, p) => percentile(runs.map((r) => r[k]), p);
  const capsPerMin = runs.map((r) => (r.caps / r.dur) * 60);
  const cristPerMin = runs.map((r) => (r.crystals / r.dur) * 60);
  const causes = {};
  for (const r of runs) causes[r.cause ?? "tempo"] = (causes[r.cause ?? "tempo"] ?? 0) + 1;
  const top = Object.entries(causes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k} ${Math.round((v / runs.length) * 100)}%`)
    .join(", ");
  console.log(
    `${label.padEnd(22)} duração ${fmt(q("dur", 0.25))} /${fmt(q("dur", 0.5))} /${fmt(q("dur", 0.75))} s` +
      ` · setor ${fmt(q("sector", 0.5))} (máx ${Math.max(...runs.map((r) => r.sector))})` +
      ` · chefes ${fmt(q("bosses", 0.5))} · cápsulas/min ${fmt(percentile(capsPerMin, 0.5), 1)}` +
      ` · cristais ${fmt(q("crystals", 0.5))} (${fmt(percentile(cristPerMin, 0.5), 1)}/min) · ${top}`,
  );
};

console.log(`${RUNS} partidas por linha · duração p25 / mediana / p75\n`);
for (const skill of [0.3, 0.6, 0.9]) {
  const runs = [];
  for (let i = 0; i < RUNS; i++) runs.push(simulate(skill, 1000 + i));
  row(`piloto ${skill} sem melhorias`, runs);
}
const upgraded = { ...DEFAULT_LOADOUT, hp: 5, gun: 3, rockets: 1, shield: true, shieldRegen: 40, magnet: 46, luck: 1.3 };
const runs = [];
for (let i = 0; i < RUNS; i++) runs.push(simulate(0.6, 2000 + i, upgraded, 0.6));
row("piloto 0.6 com hangar", runs);
