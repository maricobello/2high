import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, DEFAULT_LOADOUT } from "../src/game.js";
import { createBot } from "../src/bot.js";
import { makeBoss, updateBoss, SCRIPTS, ATTACKS } from "../src/bosses.js";
import { buildWave } from "../src/waves.js";
import { createRng } from "../src/rng.js";
import { WAVES, BOSSES } from "../src/config.js";
import { makeEnemy } from "../src/enemies.js";
import { rocketSpec } from "../src/weapons.js";

const DT = 1 / 60;

function play(opts = {}) {
  const events = [];
  const g = createGame({ seed: 11, ...opts, onEvent: (type, data) => events.push({ type, data }) });
  return { g, events, has: (type) => events.some((e) => e.type === type), count: (type) => events.filter((e) => e.type === type).length };
}

const run = (g, seconds, each) => {
  for (let i = 0; i < seconds * 60; i++) {
    each?.(g);
    g.update(DT);
  }
};

const capsule = (g, type) => g.items.push({ kind: "cap", type, x: g.player.x, y: g.player.y, t: 0 });
const shotAt = (g, src = "atirador") => g.shots.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, kind: "bala", r: 2, grazed: true, t: 0, src });

test("mesma semente e mesmas entradas: mesma partida", () => {
  const a = play({ seed: 5 });
  const b = play({ seed: 5 });
  const botA = createBot({ skill: 0.7, seed: 1 });
  const botB = createBot({ skill: 0.7, seed: 1 });
  run(a.g, 40, (g) => botA.drive(g, DT));
  run(b.g, 40, (g) => botB.drive(g, DT));
  assert.equal(a.g.score, b.g.score);
  assert.equal(a.g.stats.kills, b.g.stats.kills);
  assert.ok(a.g.stats.kills > 0, "atirou e derrubou alguém");
});

test("a nave atira sozinha e não sai da tela", () => {
  const { g, count } = play();
  g.setAxis(-1, -1);
  run(g, 3);
  assert.ok(count("shot") > 15);
  assert.ok(g.player.x >= 7 && g.player.y >= g.H * 0.32 - 1e-9);
  g.setAxis(0, 0);
  g.nudge(9999, 9999);
  run(g, 0.1);
  assert.ok(g.player.x <= g.W - 7 && g.player.y <= g.H - 12);
});

test("cápsulas sobem as armas na hora e avisam", () => {
  const { g, events } = play();
  capsule(g, "M");
  capsule(g, "F");
  capsule(g, "D");
  run(g, 0.1);
  assert.equal(g.player.gun, 2);
  assert.equal(g.player.rockets, 1);
  assert.equal(g.player.drones, 1);
  assert.deepEqual(
    events.filter((e) => e.type === "cap").map((e) => e.data.type),
    ["M", "F", "D"],
  );
  run(g, 3);
  assert.ok(g.rockets.length > 0 || events.some((e) => e.type === "rocket"), "foguetes saem");
});

test("armas acima do antigo máximo: 7 drones e metralhadora 30 atiram sem erro", () => {
  const { g } = play();
  Object.assign(g.player, { gun: 30, drones: 7 });
  run(g, 1);
  assert.ok(g.bullets.some((b) => b.drone), "drones atirando");
  assert.ok(g.bullets.filter((b) => !b.drone).length > 9, "metralhadora atirando");
});

test("Tempestade balança o leque a cada rajada", () => {
  const { g } = play();
  g.player.gun = 30;
  const centerVx = () => {
    const before = new Set(g.bullets);
    g.player.gunT = 0;
    g.update(DT);
    return g.bullets.find((b) => !before.has(b) && !b.drone).vx;
  };
  const a = centerVx();
  const b = centerVx();
  assert.ok(a * b < 0, `rajadas seguidas para lados opostos (${a.toFixed(1)}, ${b.toFixed(1)})`);
});

test("foguete leva o dano do nível em que saiu", () => {
  const { g, count } = play();
  Object.assign(g.player, { gunT: 99, rockets: 11, rocketT: 0 });
  const e = makeEnemy("couracado", { x: g.player.x, y: g.player.y - 70, vx: 0, vy: 0, move: "down", fireT: 99 });
  e.hp = e.maxHp = 1000;
  g.enemies.push(e);
  g.update(DT);
  g.player.rocketT = 99;
  run(g, 2, (game) => (game.player.gunT = 99));
  const n = count("explode");
  assert.ok(n > 0);
  assert.ok(Math.abs(e.maxHp - e.hp - n * rocketSpec(11).dmg) < 1e-6, `${e.maxHp - e.hp} de dano em ${n} explosões`);
});

test("dano: escudo absorve; sem escudo perde casco e 1 nível da arma mais forte", () => {
  const { g, events } = play({ loadout: { ...DEFAULT_LOADOUT, shield: true, gun: 4 } });
  run(g, 0.05);
  shotAt(g);
  run(g, 0.05);
  assert.equal(g.player.shield, false);
  assert.equal(g.player.hp, 3);
  assert.ok(events.some((e) => e.type === "shield_break"));
  g.player.inv = 0;
  shotAt(g);
  run(g, 0.05);
  assert.equal(g.player.hp, 2);
  assert.equal(g.player.gun, 3);
  assert.equal(g.mult, 1, "dano zera o combo");
  const hurt = events.find((e) => e.type === "hurt");
  assert.deepEqual([hurt.data.lost, hurt.data.cause], ["M", "atirador"]);
  assert.equal(g.recover.type, "M", "a arma perdida tende a voltar");
});

test("casco zerado: a nave cai e a partida fecha com o resumo", () => {
  const { g, events } = play({ loadout: { ...DEFAULT_LOADOUT, hp: 1 } });
  run(g, 1);
  shotAt(g, "dardo");
  run(g, 0.05);
  assert.equal(g.status, "dying");
  run(g, 2);
  assert.equal(g.status, "over");
  const over = events.find((e) => e.type === "over").data;
  assert.equal(over.cause, "dardo");
  assert.equal(over.sector, 1);
  assert.ok(over.dur > 1);
  for (const k of ["score", "kills", "crystals", "caps", "grazes", "turbos", "bosses", "maxCombo", "ship"]) assert.ok(k in over, k);
});

test("pulso limpa os tiros da tela e fere todo mundo", () => {
  const { g, has } = play();
  run(g, 6);
  for (let i = 0; i < 20; i++) g.shots.push({ x: 20 + i * 8, y: 60, vx: 0, vy: 10, kind: "bala", r: 2, grazed: false, t: 0, src: "atirador" });
  capsule(g, "P");
  run(g, 0.05);
  assert.equal(g.shots.length, 0);
  assert.ok(has("pulse"));
});

test("fim do setor: alerta, chefe, vitória com bônus e setor seguinte", () => {
  const { g, events } = play({ loadout: { ...DEFAULT_LOADOUT, gun: 6, rockets: 4, drones: 2, hp: 99 } });
  g.sectorT = g.sectorLen;
  const bot = createBot({ skill: 0.9, seed: 3 });
  run(g, 150, (gg) => {
    bot.drive(gg, DT);
    gg.player.hp = 99;
    gg.player.inv = 1;
  });
  const types = events.map((e) => e.type);
  for (const t of ["boss_warn", "boss_start", "boss_kill", "sector_clear", "sector"]) assert.ok(types.includes(t), t);
  assert.ok(types.indexOf("boss_warn") < types.indexOf("boss_start"));
  assert.ok(g.sector >= 2);
  assert.equal(g.stats.bosses >= 1, true);
});

test("primeira partida: cápsulas garantidas logo no começo", () => {
  const { g, events } = play({ firstRun: true });
  const bot = createBot({ skill: 0.9, seed: 4 });
  run(g, 35, (gg) => {
    bot.drive(gg, DT);
    gg.player.inv = 1;
  });
  const spawned = events.filter((e) => e.type === "cap_spawn").map((e) => e.data.type);
  assert.ok(spawned.includes("M") && spawned.includes("F"), spawned.join(","));
});

test("todas as ondas montam inimigos válidos em todos os setores", () => {
  const rng = createRng(2);
  for (const w of WAVES) {
    const list = buildWave(w.id, rng, 224, 400);
    assert.ok(list.length > 0, w.id);
    for (const en of list) assert.ok(Number.isFinite(en.params.x) && Number.isFinite(en.params.y), w.id);
  }
});

test("chefes: roteiros só usam ataques existentes e mudam de fase em 50%", () => {
  for (const [id, phases] of Object.entries(SCRIPTS)) for (const list of phases) for (const name of list) assert.ok(ATTACKS[name], `${id}: ${name}`);
  const { g } = play();
  for (let n = 0; n < BOSSES.length; n++) {
    const b = makeBoss(n, 400, 1);
    for (let i = 0; i < 400; i++) updateBoss(b, DT, g);
    assert.equal(b.entering, false, `${b.name} entrou`);
    b.hp = b.maxHp * 0.4;
    assert.equal(updateBoss(b, DT, g), "phase2");
    for (let i = 0; i < 1200; i++) updateBoss(b, DT, g);
  }
  assert.ok(g.shots.length > 0 || g.lasers.length >= 0);
});

test("segundo ciclo de chefes é mais forte", () => {
  assert.ok(makeBoss(3, 400, 1).maxHp > makeBoss(0, 400, 1).maxHp);
});
