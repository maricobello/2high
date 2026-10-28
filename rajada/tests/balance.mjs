// Simulador de balanceamento: pilotos automáticos de três níveis jogam
// dezenas de partidas sem tela, em paralelo (uma por núcleo). Mostra duração,
// setor, cristais, cápsulas, nível da metralhadora e o que mais derruba, e
// confere os critérios da especificação (S4, S7, S8, S9). No modo longo, S7
// vale também para o piloto médio com melhorias do hangar.
// Uso: npm run balance [-- partidas]   ·   npm run balance -- longo
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { availableParallelism } from "node:os";
import { createGame, DEFAULT_LOADOUT } from "../src/game.js";
import { createBot } from "../src/bot.js";
import { percentile } from "../src/stats.js";

const DT = 1 / 60;
const UPGRADED = { ...DEFAULT_LOADOUT, hp: 5, gun: 3, rockets: 1, shield: true, shieldRegen: 40, magnet: 46, luck: 1.3, luckLevel: 2 };
const S1_BASE = 53.9; // inimigos/min no setor 1 antes do começo cheio (Tarefa 7, piloto 0.6)

function simulate({ skill, seed, upgraded, gameSkill, limit }) {
  let over = null;
  const loadout = upgraded ? UPGRADED : DEFAULT_LOADOUT;
  const g = createGame({ seed, skill: gameSkill, loadout, onEvent: (t, d) => t === "over" && (over = d) });
  const bot = createBot({ skill, seed: seed * 7 + 1 });
  while (!over && g.t < limit) {
    bot.drive(g, DT);
    g.update(DT);
  }
  return over ?? { ...g.summary(), timeout: true };
}

if (!isMainThread) {
  parentPort.on("message", (job) => parentPort.postMessage({ id: job.id, run: simulate(job) }));
} else {
  const long = process.argv[2] === "longo";
  const RUNS = long ? 20 : Number(process.argv[2] ?? 30);
  const LIMIT = (long ? 60 : 15) * 60; // s

  const groups = long
    ? [
        { label: "piloto 0.9 (longo)", skill: 0.9, seedBase: 3000 },
        { label: "piloto 0.6 com hangar (longo)", skill: 0.6, seedBase: 4000, upgraded: true, gameSkill: 0.6 },
      ]
    : [
        { label: "piloto 0.3 sem melhorias", skill: 0.3, seedBase: 1000 },
        { label: "piloto 0.6 sem melhorias", skill: 0.6, seedBase: 1000 },
        { label: "piloto 0.9 sem melhorias", skill: 0.9, seedBase: 1000 },
        { label: "piloto 0.6 com hangar", skill: 0.6, seedBase: 2000, upgraded: true, gameSkill: 0.6 },
      ];
  const jobs = groups.flatMap((gr, gi) =>
    Array.from({ length: RUNS }, (_, i) => ({ gi, skill: gr.skill, seed: gr.seedBase + i, upgraded: !!gr.upgraded, gameSkill: gr.gameSkill ?? 0.3, limit: LIMIT })),
  );
  jobs.forEach((j, id) => (j.id = id));

  // fila simples: cada núcleo pega a próxima partida quando termina a sua
  const results = new Array(jobs.length);
  const workers = Math.min(availableParallelism(), jobs.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: workers }, () =>
      new Promise((resolve, reject) => {
        const w = new Worker(new URL(import.meta.url));
        const feed = () => (next < jobs.length ? w.postMessage(jobs[next++]) : w.terminate().then(resolve));
        w.on("message", ({ id, run }) => {
          results[id] = run;
          feed();
        });
        w.on("error", reject);
        feed();
      }),
    ),
  );

  const fmt = (v, d = 0) => v.toFixed(d).padStart(6);
  const byGroup = groups.map((_, gi) => jobs.filter((j) => j.gi === gi).map((j) => results[j.id]));
  const med = (runs, f) => percentile(runs.map(f), 0.5);
  console.log(`${RUNS} partidas por linha · limite ${LIMIT / 60} min · duração p25 / mediana / p75\n`);
  groups.forEach((gr, gi) => {
    const runs = byGroup[gi];
    const q = (k, p) => percentile(runs.map((r) => r[k]), p);
    const causes = {};
    for (const r of runs) causes[r.cause ?? "tempo"] = (causes[r.cause ?? "tempo"] ?? 0) + 1;
    const top = Object.entries(causes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, v]) => `${k} ${Math.round((v / runs.length) * 100)}%`)
      .join(", ");
    const s1 = runs.filter((r) => r.s1Time > 0).map((r) => (r.s1Spawns / r.s1Time) * 60);
    console.log(
      `${gr.label.padEnd(26)} duração ${fmt(q("dur", 0.25))} /${fmt(q("dur", 0.5))} /${fmt(q("dur", 0.75))} s` +
        ` · setor ${fmt(q("sector", 0.5))} (máx ${Math.max(...runs.map((r) => r.sector))})` +
        ` · chefes ${fmt(q("bosses", 0.5))} · metralhadora nv ${fmt(q("maxGun", 0.5))} (máx ${Math.max(...runs.map((r) => r.maxGun))})` +
        ` · cápsulas/min ${fmt(med(runs, (r) => (r.caps / r.dur) * 60), 1)}` +
        ` · cristais ${fmt(q("crystals", 0.5))} · inimigos/min setor 1 ${fmt(percentile(s1, 0.5), 1)} · ${top}`,
    );
  });

  console.log("");
  const check = (name, ok, text) => console.log(`${ok ? "ok " : "NÃO"} ${name}: ${text}`);
  if (long) {
    // partidas não ficam eternas: nem para o melhor piloto, nem para quem já tem melhorias no hangar
    groups.forEach((gr, gi) => {
      const runs = byGroup[gi];
      const before30 = runs.filter((r) => !r.timeout && r.sector < 30).length / runs.length;
      check("S7", before30 >= 0.95, `${Math.round(before30 * 100)}% das partidas do ${gr.label} acabam antes do setor 30 (meta ≥ 95%)`);
    });
  } else {
    const [p3, p6] = byGroup;
    const s1 = percentile(p6.filter((r) => r.s1Time > 0).map((r) => (r.s1Spawns / r.s1Time) * 60), 0.5);
    check("S4", s1 >= 1.8 * S1_BASE, `piloto 0.6 vê ${s1.toFixed(1)} inimigos/min no setor 1 (meta ≥ ${(1.8 * S1_BASE).toFixed(1)})`);
    const d3 = med(p3, (r) => r.dur);
    const d6 = med(p6, (r) => r.dur);
    check("S8", d3 >= 180 && d6 >= 480 && d6 <= 840, `piloto 0.3 mediana ${(d3 / 60).toFixed(1)} min (≥ 3); piloto 0.6 ${(d6 / 60).toFixed(1)} min (8 a 14)`);
    const gun6 = med(p6, (r) => r.maxGun);
    check("S9", gun6 >= 10, `piloto 0.6 chega ao nível ${gun6} da metralhadora (mediana, meta ≥ 10)`);
  }
}
