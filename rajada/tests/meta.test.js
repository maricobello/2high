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
  upgradeCost,
} from "../src/progress.js";
import { upgradesPanel, collectionData, collectionPanel } from "../src/ui.js";

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

test("save antigo abre sem perder nada", () => {
  const p = sanitizeProfile({ cristais: 500, upgrades: { canhao: 3, sorte: 3 }, stats: { runs: 4, best: { score: 900, sector: 3 } } });
  assert.equal(p.cristais, 500);
  assert.equal(p.upgrades.canhao, 3);
  assert.equal(p.stats.best.score, 900);
  assert.equal(p.stats.best.gun, 0);
  assert.deepEqual(p.stats.bossKills, {});
});

test("hangar sem fim: preço cresce 1,5× depois da tabela", () => {
  assert.equal(upgradeCost("canhao", 3), 1350);
  assert.equal(upgradeCost("canhao", 4), 2030);
  assert.equal(upgradeCost("foguetes", 2), 1130);
  assert.equal(upgradeCost("casco", 2), null);
  const p = sanitizeProfile({ upgrades: { canhao: 14, casco: 9 } });
  assert.equal(p.upgrades.canhao, 14, "nível acima da tabela continua no save");
  assert.equal(p.upgrades.casco, 2, "o que tem teto continua com teto");
});

test("Canhão 10 começa no nível 11 e Sorte 6 sobe a raridade", () => {
  const base = defaultProfile();
  const l = loadoutFor({ ...base, upgrades: { ...base.upgrades, canhao: 10, sorte: 6 } });
  assert.equal(l.gun, 11);
  assert.equal(l.luck, 1.5);
  assert.equal(l.luckLevel, 6);
});

test("missões novas têm texto e contam progresso", () => {
  assert.equal(KINDS.form_run.text({ n: 15 }), "Chegue à forma Perfurante");
  assert.equal(KINDS.form_run.value({ maxGun: 15 }), 15);
  assert.equal(KINDS.gun_level_run.text({ n: 22 }), "Chegue ao nível 22 da metralhadora");
  assert.equal(KINDS.rarity_run.text({ n: 3 }), "Pegue uma cápsula lendária");
  assert.equal(KINDS.rarity_run.text({ n: 2 }), "Pegue uma cápsula épica");
  assert.equal(KINDS.boss_kill_total.text({ n: 1, type: "rainha" }), "Derrote a Rainha");
  assert.equal(KINDS.boss_kill_total.text({ n: 1, type: "colosso" }), "Derrote o Colosso");
  assert.equal(KINDS.boss_kill_total.value({ bossesBy: { rainha: 2 } }, { type: "rainha" }), 2);
});

test("recordes de arma, raridade e chefes entram nas estatísticas", () => {
  const s = recordRun(emptyStats(), run({ maxGun: 22, maxRockets: 9, maxDrones: 4, bestRarity: 3, bossesBy: { rainha: 1 }, bossesSeen: ["rainha"] }), "d");
  assert.equal(s.best.gun, 22);
  assert.equal(s.best.rarity, 3);
  assert.deepEqual(s.bossKills, { rainha: 1 });
  assert.equal(s.bossSeen.rainha, true);
  const again = sanitizeStats(JSON.parse(JSON.stringify(s)));
  assert.equal(again.best.drones, 4);
  assert.equal(again.bossSeen.rainha, true);
});

test("missões de forma, raridade e chefe aparecem para quem já chegou perto", () => {
  const stats = recordRun(emptyStats(), run({ maxGun: 12, bestRarity: 1, bosses: 1, bossesBy: { colosso: 1 }, bossesSeen: ["colosso", "aranha"] }), "d");
  const kinds = Object.fromEntries(missionOptions(stats).map((o) => [o.kind, o]));
  assert.equal(kinds.form_run.n, 15, "próxima forma: Perfurante");
  assert.ok(kinds.gun_level_run.n > 12);
  assert.equal(kinds.rarity_run.n, 2);
  assert.equal(kinds.boss_kill_total.type, "aranha", "o chefe visto e ainda não derrotado");
});

test("hangar: Canhão, Foguetes e Sorte nunca ficam no máximo", () => {
  const base = defaultProfile();
  const html = upgradesPanel({ ...base, cristais: 0, upgrades: { ...base.upgrades, canhao: 9, sorte: 5, foguetes: 7, casco: 2 } }, () => "x");
  const card = (key) => html.split('<div class="upgrade">').find((c) => c.includes(`data-buy="${key}"`));
  assert.ok(!card("canhao").includes("MÁX"));
  assert.ok(card("sorte").includes("mais chance de raras"));
  assert.ok(card("casco").includes("MÁX"));
});

test("coleção: chefe não visto é silhueta; forma liberada pelo recorde", () => {
  const base = defaultProfile();
  const stats = { ...base.stats, bossSeen: { colosso: true }, bossKills: { colosso: 2 }, best: { ...base.stats.best, gun: 16, rockets: 5, drones: 0 } };
  const data = collectionData({ ...base, stats });
  const boss = (id) => data.bosses.find((b) => b.id === id);
  assert.equal(data.bosses.length, 6);
  assert.deepEqual([boss("colosso").seen, boss("colosso").kills], [true, 2]);
  assert.equal(boss("aranha").seen, false);
  const form = (name) => data.forms.gun.find((f) => f.name === name);
  assert.equal(form("Perfurante").unlocked, true);
  assert.equal(form("Caçadora").unlocked, false);
  assert.equal(form("Rajada").unlocked, true, "a forma inicial sempre aparece");
  assert.equal(data.forms.rockets.find((f) => f.at === 5).unlocked, true);
  assert.equal(data.forms.drones.find((f) => f.at === 4).unlocked, false);
  const html = collectionPanel(data, () => "x");
  assert.ok(html.includes("???"), "chefe nunca visto sem nome");
  assert.ok(html.includes("Nível 20"), "forma bloqueada mostra só o nível");
  assert.ok(!html.includes("Caçadora"), "nome da forma bloqueada fica escondido");
  assert.ok(html.includes("Derrotado 2×"));
});
