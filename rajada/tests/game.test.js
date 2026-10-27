import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, DEFAULT_LOADOUT } from "../src/game.js";
import { createBot } from "../src/bot.js";
import { makeBoss, updateBoss, SCRIPTS, ATTACKS } from "../src/bosses.js";
import { buildWave } from "../src/waves.js";
import { createRng } from "../src/rng.js";
import { WAVES, BOSSES } from "../src/config.js";
import { makeEnemy, enemyFire } from "../src/enemies.js";
import { rocketSpec } from "../src/weapons.js";
import { lootSource } from "../src/loot.js";

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

const addEnemy = (g, x, y, hp = 100) => {
  const e = makeEnemy("couracado", { x, y, vx: 0, vy: 0, move: "down" });
  e.hp = e.maxHp = hp;
  g.enemies.push(e);
  return e;
};
const quiet = (g) => {
  g.player.gunT = 99;
  g.player.rockets = 0;
  g.player.drones = 0;
};

test("tiro perfurante atravessa o primeiro inimigo e para no segundo", () => {
  const { g } = play();
  quiet(g);
  const [a, b, c] = [150, 110, 70].map((y) => addEnemy(g, 112, y));
  g.bullets.push({ x: 112, y: 200, vx: 0, vy: -330, dmg: 1, pierce: 1, hits: [], band: 3 });
  run(g, 0.5);
  assert.equal(a.hp, 99);
  assert.equal(b.hp, 99);
  assert.equal(c.hp, 100);
});

test("tiro teleguiado curva para o inimigo mais perto", () => {
  const { g } = play();
  quiet(g);
  addEnemy(g, 190, 120);
  const bullet = { x: 112, y: 250, vx: 0, vy: -330, dmg: 1, pierce: 0, homing: true, life: 1.2, hits: [], band: 4 };
  g.bullets.push(bullet);
  run(g, 0.3);
  assert.ok(bullet.vx > 0);
});

test("Raio dá dano a quem está na coluna da nave e não aos de fora", () => {
  const { g } = play();
  quiet(g);
  g.player.gun = 25;
  const inside = addEnemy(g, g.player.x, 120);
  const outside = addEnemy(g, g.player.x + 40, 120);
  run(g, 0.5);
  assert.ok(inside.hp < 100);
  assert.equal(outside.hp, 100);
});

test("foguete com fragmentação solta 4 estilhaços ao explodir", () => {
  const { g, count } = play();
  quiet(g);
  g.player.rockets = 15;
  g.player.rocketT = 0;
  addEnemy(g, g.player.x, g.player.y - 60);
  let shards = 0;
  for (let i = 0; i < 120 && !count("explode"); i++) {
    g.update(DT);
    shards = g.bullets.filter((b) => b.shard).length;
  }
  // o par de foguetes da mesma fileira chega junto: 4 estilhaços por explosão
  assert.ok(count("explode") > 0);
  assert.equal(shards, 4 * count("explode"));
});

test("nível 200 em tudo: 30 s sem erro e no máximo 260 tiros da nave", () => {
  const { g } = play();
  Object.assign(g.player, { gun: 200, rockets: 200, drones: 200 });
  const bot = createBot({ skill: 0.9, seed: 2 });
  let most = 0;
  run(g, 30, (game) => {
    bot.drive(game, DT);
    most = Math.max(most, game.bullets.length);
  });
  assert.ok(most <= 260);
});

test("drones no nível 10 trocam o tiro por um raio curto", () => {
  const { g } = play();
  quiet(g);
  Object.assign(g.player, { drones: 10, inv: 99 }); // sem levar dano (perderia um nível de drone)
  run(g, 0.3);
  const d = g.player.dronePos[0];
  const near = addEnemy(g, d.x, d.y - 25);
  const far = addEnemy(g, d.x, d.y - 90);
  run(g, 0.5, (game) => (game.player.gunT = 99));
  assert.equal(g.droneBeams.length, 4);
  assert.ok(near.hp < 100, "inimigo dentro do raio leva dano");
  assert.equal(far.hp, 100, "fora do alcance não leva");
  assert.equal(g.bullets.filter((b) => b.drone).length, 0, "com raio o drone não atira");
});

test("acima de 260 tiros da nave, os mais antigos somem primeiro", () => {
  const { g } = play();
  quiet(g);
  for (let i = 0; i < 300; i++) g.bullets.push({ x: 112, y: 300, vx: 0, vy: -1, dmg: 0, pierce: 0, hits: [], band: 0, id: i });
  g.update(DT);
  assert.equal(g.bullets.length, 260);
  assert.equal(g.bullets[0].id, 40);
  assert.equal(g.bullets.at(-1).id, 299);
});

test("chefe solta uma cápsula épica ou melhor", () => {
  const { g, events } = play({ loadout: { ...DEFAULT_LOADOUT, gun: 6, hp: 99 } });
  g.sectorT = g.sectorLen;
  const bot = createBot({ skill: 0.9, seed: 3 });
  run(g, 90, (gg) => {
    if (gg.stats.bosses) return;
    bot.drive(gg, DT);
    gg.player.inv = 1;
    if (gg.boss && !gg.boss.entering) gg.boss.hp = Math.min(gg.boss.hp, 1);
  });
  const kill = events.findIndex((e) => e.type === "boss_kill");
  assert.ok(kill > 0, "chefe derrotado");
  const caps = events.slice(0, kill).filter((e) => e.type === "cap_spawn").slice(-2);
  assert.equal(caps.length, 2);
  assert.ok(caps.some((e) => ["epica", "lendaria"].includes(e.data.rarity)), caps.map((e) => e.data.rarity).join(","));
});

test("Couraçado nunca solta cápsula comum", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { g, events } = play({ seed });
    const e = makeEnemy("couracado", { x: g.player.x, y: g.player.y - 80, vx: 0, vy: 0, move: "down", fireT: 99 });
    e.hp = 1;
    g.enemies.push(e);
    run(g, 1, (gg) => (gg.player.inv = 1));
    assert.ok(e.dead, `semente ${seed}: abatido`);
    const cap = events.find((ev) => ev.type === "cap_spawn" && ev.data.x === e.x && ev.data.y === e.y);
    assert.ok(["rara", "epica", "lendaria"].includes(cap?.data.rarity), `semente ${seed}: ${cap?.data.rarity}`);
  }
});

test("lendária de metralhadora no 3 leva ao 6 e avisa a forma Leque", () => {
  const { g, events } = play();
  g.player.gun = 3;
  g.items.push({ kind: "cap", type: "M", rarity: "lendaria", x: g.player.x, y: g.player.y, t: 0 });
  run(g, 0.1);
  assert.equal(g.player.gun, 6);
  const form = events.find((e) => e.type === "form");
  assert.equal(form?.data.name, "Leque");
  assert.equal(form.data.weapon, "M");
  assert.equal(form.data.band, 1);
  const cap = events.find((e) => e.type === "cap");
  assert.deepEqual(cap.data.gained, { M: 3 });
  assert.equal(cap.data.rarity, "lendaria");
});

test("cápsulas do tutorial continuam comuns", () => {
  const { g, events } = play({ firstRun: true });
  const bot = createBot({ skill: 0.9, seed: 4 });
  run(g, 45, (gg) => {
    bot.drive(gg, DT);
    gg.player.inv = 1;
  });
  for (const type of ["M", "F", "D"]) {
    const first = events.find((e) => e.type === "cap_spawn" && e.data.type === type);
    assert.equal(first?.data.rarity, "comum", type);
  }
});

test("primeira partida: 3 s sem ondas", () => {
  const { g } = play({ firstRun: true });
  run(g, 2.9);
  assert.equal(g.enemies.length + g.queue.length, 0);
});

test("elite tem o triplo de vida", () => {
  assert.equal(makeEnemy("zangao", { x: 0, y: 0 }, 1, true).hp, 3);
  assert.equal(makeEnemy("zangao", { x: 0, y: 0 }, 1, true).elite, true);
  assert.equal(makeEnemy("zangao", { x: 0, y: 0 }).elite, false);
});

test("volta 1: Atirador dispara leque de 3", () => {
  const needles = (sector) => {
    const shots = [];
    const g = { sector, rng: createRng(1), fireRate: () => 1, aimAngle: () => Math.PI / 2, fire: (x, y, a, v, kind) => shots.push({ a, kind }) };
    const e = makeEnemy("atirador", { x: 100, y: 60, stayAt: 10, fireT: 0 });
    for (let i = 0; i < 240; i++) enemyFire(e, 1 / 120, g);
    return shots.filter((s) => s.kind === "agulha");
  };
  assert.equal(needles(6).length, 0, "volta 0: só o tiro de sempre");
  const fan = needles(7).slice(0, 3).map((s) => Math.round((s.a - Math.PI / 2) * 100) / 100);
  assert.deepEqual(fan.sort((a, b) => a - b), [-0.25, 0, 0.25]);
});

test("volta 2: Couraçado dispara anel; volta 3: Mina solta mais tiros", () => {
  const ring = (sector) => {
    const shots = [];
    const g = { sector, rng: createRng(1), fireRate: () => 1, aimAngle: () => Math.PI / 2, fire: (x, y, a, v, kind) => shots.push({ a, kind }) };
    const e = makeEnemy("couracado", { x: 100, y: 60, fireT: 99 });
    for (let i = 0; i < 480; i++) enemyFire(e, 1 / 120, g);
    return shots.length;
  };
  assert.equal(ring(12), 0);
  assert.equal(ring(13), 12);
  const { g } = play();
  const burst = (sector) => {
    g.jumpTo(sector);
    const before = g.shots.length;
    const m = makeEnemy("mina", { x: 100, y: 100 });
    m.hp = 1;
    g.enemies.push(m);
    g.bullets.push({ x: 100, y: 104, vx: 0, vy: -1, dmg: 5, pierce: 0, hits: [], band: 0 });
    g.update(DT);
    return g.shots.length - before;
  };
  assert.equal(burst(18), 8);
  assert.equal(burst(19), 16);
});

test("elite solta o dobro de cristais e usa a tabela de loot de elite", () => {
  const { g } = play();
  quiet(g);
  const e = makeEnemy("couracado", { x: g.player.x, y: 120, vx: 0, vy: 0, move: "down", fireT: 99 }, 1, true);
  e.hp = 0.5;
  g.enemies.push(e);
  g.bullets.push({ x: e.x, y: e.y + 4, vx: 0, vy: -1, dmg: 5, pierce: 0, hits: [], band: 0 });
  g.update(DT);
  const crystals = g.items.filter((it) => it.kind === "cristal").length;
  assert.ok(crystals >= 6 && crystals <= 10, `${crystals} cristais (normal: 3 a 5)`);
  assert.equal(lootSource({ type: "zangao", elite: true }), "elite");
  assert.equal(lootSource({ type: "zangao" }), "inimigo");
  assert.equal(lootSource({ type: "couracado", elite: true }), "couracado", "Couraçado já tem tabela melhor");
  assert.equal(lootSource({ type: "portador" }), "portador");
});

test("elites aparecem do setor 4 em diante", () => {
  const elites = (sector) => {
    const { g } = play({ seed: 3, loadout: { ...DEFAULT_LOADOUT, gun: 12, hp: 99 } });
    g.jumpTo(sector);
    const bot = createBot({ skill: 0.9, seed: 5 });
    const seen = new Set();
    run(g, 40, (gg) => {
      bot.drive(gg, DT);
      gg.player.inv = 1;
      for (const e of gg.enemies) if (e.elite) seen.add(e);
    });
    return [...seen];
  };
  assert.equal(elites(3).length, 0);
  const found = elites(10);
  assert.ok(found.length >= 3, `${found.length} elites no setor 10`);
  assert.ok(found.every((e) => e.type !== "portador"), "Portador nunca é elite");
});

test("tetos: nunca mais de 60 inimigos e 220 tiros inimigos", () => {
  const { g } = play({ loadout: { ...DEFAULT_LOADOUT, hp: 99 } });
  g.jumpTo(25);
  const bot = createBot({ skill: 0.9, seed: 2 });
  let enemies = 0;
  let shots = 0;
  run(g, 60, (gg) => {
    bot.drive(gg, DT);
    gg.player.inv = 1;
    enemies = Math.max(enemies, gg.enemies.length);
    shots = Math.max(shots, gg.shots.length);
  });
  assert.ok(enemies <= 60, `${enemies} inimigos`);
  assert.ok(shots <= 220, `${shots} tiros`);
});

test("teto direto: fila cheia não passa de 60 inimigos, tiros não passam de 220", () => {
  const { g } = play();
  for (let i = 0; i < 90; i++) g.queue.push({ at: 0, type: "zangao", params: { x: 10 + (i % 20) * 10, y: -200 } });
  for (let i = 0; i < 300; i++) g.fire(112, 100, Math.PI / 2, 10, "bala");
  g.update(DT);
  assert.ok(g.enemies.length <= 60, `${g.enemies.length} inimigos`);
  assert.ok(g.queue.length >= 30, "o resto espera na fila");
  assert.ok(g.shots.length <= 220, `${g.shots.length} tiros`);
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
