import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/rng.js";
import { emptyStats, recordRun, sanitizeStats, percentile, topEnemyCause, isStruggling, performance } from "../src/stats.js";
import { missionOptions, fillMissions, settleMissions, liveProgress, missionText, KINDS } from "../src/missions.js";
import {
  defaultProfile,
  sanitizeProfile,
  buyUpgrade,
  canBuy,
  loadoutFor,
  rankOf,
  applyRun,
  nextUpgradeGoal,
  ensureMissions,
  shipUnlockMet,
} from "../src/progress.js";

const run = (over = {}) => ({
  score: 3000,
  sector: 1,
  dur: 80,
  crystals: 40,
  kills: 50,
  killsBy: { gun: 45, rockets: 5, drones: 0, pulse: 0, crash: 0 },
  killsType: { zangao: 40, atirador: 10 },
  caps: 4,
  capsBy: { M: 2, F: 2 },
  grazes: 6,
  turbos: 1,
  bosses: 0,
  noHitBoss: false,
  maxCombo: 3,
  carriers: 1,
  damage: 3,
  cause: "atirador",
  ship: "faisca",
  ...over,
});

test("estatísticas somam, guardam só as 20 últimas e estimam a habilidade", () => {
  let s = emptyStats();
  for (let i = 0; i < 25; i++) s = recordRun(s, run({ score: i * 100, sector: 1 + (i % 3) }), "2026-10-27");
  assert.equal(s.runs, 25);
  assert.equal(s.recent.length, 20);
  assert.equal(s.kills, 25 * 50);
  assert.equal(s.best.score, 2400);
  assert.equal(s.days, 1);
  assert.ok(s.skill > 0 && s.skill < 1);
  const before = s.skill;
  for (let i = 0; i < 6; i++) s = recordRun(s, run({ sector: 6, dur: 500, bosses: 5 }), "2026-10-28");
  assert.ok(s.skill > before, "jogar bem sobe a habilidade");
  assert.equal(s.days, 2);
});

test("desempenho de uma partida fica entre 0 e 1 e cresce com o setor", () => {
  assert.ok(performance(run({ sector: 3 })) > performance(run({ sector: 1 })));
  assert.equal(performance(run({ sector: 50, dur: 9999, bosses: 9 })), 1);
});

test("três quedas seguidas antes do primeiro chefe ligam a folga", () => {
  let s = emptyStats();
  for (let i = 0; i < 3; i++) s = recordRun(s, run(), "d");
  assert.equal(isStruggling(s), true);
  s = recordRun(s, run({ bosses: 1, sector: 2 }), "d");
  assert.equal(isStruggling(s), false);
});

test("estatísticas salvas estragadas viram valores seguros", () => {
  const s = sanitizeStats({ runs: "x", kills: -5, best: { score: "9" }, recent: [null, { score: 5 }], skill: 7, causes: { dardo: "2", x: "a" } });
  assert.equal(s.runs, 0);
  assert.equal(s.kills, 0);
  assert.equal(s.best.score, 9);
  assert.equal(s.recent.length, 1);
  assert.equal(s.skill, 1);
  assert.deepEqual(s.causes, { dardo: 2 });
});

test("percentil e inimigo que mais derruba", () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(percentile([], 0.5), 0);
  let s = emptyStats();
  assert.equal(topEnemyCause(s), null);
  s = recordRun(s, run({ cause: "dardo" }), "d");
  s = recordRun(s, run({ cause: "dardo" }), "d");
  s = recordRun(s, run({ cause: "chefe" }), "d");
  assert.equal(topEnemyCause(s), "dardo");
});

test("missões: alvo sai das partidas do jogador e acompanha a evolução", () => {
  const novato = missionOptions(emptyStats()).find((o) => o.kind === "kills_run");
  let s = emptyStats();
  for (let i = 0; i < 10; i++) s = recordRun(s, run({ kills: 200 }), "d");
  const veterano = missionOptions(s).find((o) => o.kind === "kills_run");
  assert.equal(novato.n, 20);
  assert.ok(veterano.n >= 200, `alvo ${veterano.n}`);
  assert.equal(veterano.n % 5, 0, "número redondo");
});

test("missões: o que te derruba e a arma esquecida viram missão", () => {
  let s = emptyStats();
  for (let i = 0; i < 4; i++) s = recordRun(s, run({ cause: "atirador", killsBy: { gun: 50, rockets: 0 } }), "d");
  const opts = missionOptions(s);
  const tipo = opts.find((o) => o.kind === "type_total");
  assert.equal(tipo.type, "atirador");
  assert.ok(opts.find((o) => o.kind === "rockets_run").weight > 3);
  const nave = missionOptions(s, ["faisca", "vespa"]).find((o) => o.kind === "ship_run");
  assert.equal(nave.type, "vespa");
});

test("sempre 3 missões, sem tipo repetido, com texto em português", () => {
  const rng = createRng(3);
  const list = fillMissions([], emptyStats(), ["faisca"], rng);
  assert.equal(list.length, 3);
  assert.equal(new Set(list.map((m) => m.kind)).size, 3);
  for (const m of list) assert.match(missionText(m), /^[A-ZÁÉ]/);
  for (const m of list) assert.equal(m.reward, KINDS[m.kind].reward);
});

test("progresso de missão: melhor partida ou soma, conforme o tipo", () => {
  const porPartida = { id: "a", kind: "kills_run", n: 60, progress: 30 };
  const soma = { id: "b", kind: "carriers_total", n: 3, progress: 1 };
  assert.equal(liveProgress(porPartida, run({ kills: 20 })), 30);
  assert.equal(liveProgress(porPartida, run({ kills: 70 })), 70);
  assert.equal(liveProgress(soma, run({ carriers: 1 })), 2);
  const { done, open } = settleMissions([porPartida, soma], run({ kills: 70, carriers: 2 }));
  assert.deepEqual(done.map((m) => m.id), ["a", "b"]);
  assert.equal(open.length, 0);
  assert.equal(done[0].progress, 60);
});

test("hangar: compra desconta, respeita o nível máximo e muda a nave", () => {
  let p = { ...defaultProfile(), cristais: 1000 };
  assert.equal(canBuy(p, "ima"), true);
  ({ profile: p } = buyUpgrade(p, "ima"));
  assert.equal(p.cristais, 940);
  assert.equal(p.upgrades.ima, 1);
  assert.equal(loadoutFor(p).magnet, 24);
  p = { ...p, cristais: 1e6 };
  for (let i = 0; i < 10; i++) ({ profile: p } = buyUpgrade(p, "casco"));
  assert.equal(p.upgrades.casco, 2);
  assert.equal(loadoutFor(p).hp, 5);
  assert.equal(buyUpgrade({ ...defaultProfile(), cristais: 10 }, "canhao").ok, false);
});

test("carga da partida não corta nível de arma", () => {
  const d = defaultProfile();
  const p = { ...d, upgrades: { ...d.upgrades, canhao: 9, foguetes: 7 } };
  assert.equal(loadoutFor(p).gun, 10);
  assert.equal(loadoutFor(p).rockets, 7);
});

test("meta mais próxima do hangar diz quanto falta", () => {
  const goal = nextUpgradeGoal({ ...defaultProfile(), cristais: 20 });
  assert.deepEqual(goal, { key: "ima", cost: 60, level: 1, missing: 40 });
});

test("patente sobe a cada 3 missões e dá bônus de cristais com teto", () => {
  assert.equal(rankOf(0).name, "Cadete");
  assert.equal(rankOf(3).name, "Aspirante");
  assert.equal(rankOf(4).progress, 1);
  assert.equal(rankOf(300).bonus, 0.5);
  assert.equal(rankOf(30).name, "Lenda");
  assert.equal(rankOf(33).name, "Lenda 2");
});

test("fim de partida: bônus diário uma vez por dia, missões pagas e naves liberadas", () => {
  const rng = createRng(5);
  let p = ensureMissions(defaultProfile(), rng);
  p = { ...p, missions: [{ id: "x", kind: "sector", n: 3, progress: 0, reward: 60 }, ...p.missions.slice(1)] };
  const r1 = applyRun(p, run({ crystals: 40, sector: 3, bosses: 2 }), "2026-10-27", rng);
  assert.equal(r1.reward.base, 40);
  assert.equal(r1.reward.daily, 40, "primeira partida do dia dobra");
  assert.ok(r1.reward.missions >= 60);
  assert.equal(r1.profile.missions.length, 3);
  assert.ok(r1.newShips.includes("vespa"), "setor 3 libera a Vespa");
  assert.ok(shipUnlockMet("vespa", r1.profile));
  const r2 = applyRun(r1.profile, run({ crystals: 40 }), "2026-10-27", rng);
  assert.equal(r2.reward.daily, 0, "segunda partida do dia sem bônus");
  const r3 = applyRun(r2.profile, run({ crystals: 40 }), "2026-10-28", rng);
  assert.equal(r3.reward.daily, r3.reward.base + r3.reward.rank, "dia novo, bônus de novo");
  assert.ok(r3.reward.daily > 0);
});

test("recorde só conta a partir da segunda partida", () => {
  const rng = createRng(2);
  const r1 = applyRun(defaultProfile(), run({ score: 500 }), "d", rng);
  assert.equal(r1.records.score, false);
  const r2 = applyRun(r1.profile, run({ score: 900 }), "d", rng);
  assert.equal(r2.records.score, true);
});

test("perfil salvo estragado ou antigo vira um perfil válido", () => {
  const p = sanitizeProfile({
    cristais: "50",
    upgrades: { ima: 99, casco: -3 },
    ship: "vespa",
    ships: ["vespa", "inexistente"],
    missions: [{ kind: "nada" }, { id: 1, kind: "kills_run", n: 30, progress: 2 }],
    settings: { music: false },
  });
  assert.equal(p.cristais, 50);
  assert.equal(p.upgrades.ima, 4);
  assert.equal(p.upgrades.casco, 0);
  assert.deepEqual(p.ships, ["faisca", "vespa"]);
  assert.equal(p.ship, "vespa");
  assert.equal(p.missions.length, 1);
  assert.equal(p.settings.music, false);
  assert.equal(p.settings.sfx, true);
  assert.deepEqual(sanitizeProfile("lixo"), defaultProfile());
});
