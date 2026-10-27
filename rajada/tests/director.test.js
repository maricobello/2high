import { test } from "node:test";
import assert from "node:assert/strict";
import { tension, cycleLength, skillAdjust, threatCap, pickWave, waveGap } from "../src/director.js";
import { killDropChance, capsuleWeights, pickCapsule, applyCapsule, weaponToLose, loseWeapon } from "../src/drops.js";
import { createRng } from "../src/rng.js";
import { DIRECTOR, DROPS } from "../src/config.js";

const ship = (over = {}) => ({ gun: 1, rockets: 0, drones: 0, shield: false, hp: 3, maxHp: 3, ...over });

test("tensão sobe, fica no pico, alivia e repete", () => {
  const [up, peak] = DIRECTOR.cycle;
  assert.equal(tension(0), DIRECTOR.floor);
  assert.ok(tension(up / 2) > tension(1));
  assert.equal(tension(up + 1), 1);
  assert.equal(tension(up + peak + 1), DIRECTOR.relax);
  assert.equal(tension(cycleLength() + 2), tension(2));
});

test("habilidade mexe no máximo 15% e quem está penando ganha folga", () => {
  const novato = skillAdjust(0);
  const fera = skillAdjust(1);
  assert.ok(Math.abs(novato.pressure - 0.85) < 1e-9);
  assert.ok(Math.abs(fera.pressure - 1.15) < 1e-9);
  assert.ok(skillAdjust(0.5, true).pressure < skillAdjust(0.5).pressure);
  assert.ok(novato.earlyDrops > fera.earlyDrops);
  assert.deepEqual(skillAdjust(NaN), skillAdjust(0.3));
});

test("casco em 1 reduz a ameaça; jogo fácil demais aumenta", () => {
  const adjust = skillAdjust(0.5);
  const base = { sector: 1, t: 15, adjust, hp: 3, sinceHit: 0, strong: false };
  const normal = threatCap(base);
  assert.ok(threatCap({ ...base, hp: 1 }) < normal);
  assert.ok(threatCap({ ...base, strong: true, sinceHit: 60 }) > normal);
  assert.ok(threatCap({ ...base, sector: 3 }) > normal);
});

test("onda escolhida cabe na folga e respeita setor e tempo mínimos", () => {
  const rng = createRng(4);
  for (let i = 0; i < 200; i++) {
    const id = pickWave(rng, { sector: 1, t: 5, room: 7, last: null });
    assert.ok(["fila", "v", "serpente", "dardos", "atiradores", "pedras"].includes(id), id);
  }
  assert.equal(pickWave(rng, { sector: 1, t: 5, room: 1, last: null }), null);
  const late = new Set();
  for (let i = 0; i < 400; i++) late.add(pickWave(rng, { sector: 3, t: 40, room: 99, last: null }));
  assert.ok(late.has("chuva") && late.has("minas") && late.has("couracado"));
});

test("intervalo entre ondas encurta nos setores seguintes", () => {
  const avg = (sector) => {
    const rng = createRng(9);
    let s = 0;
    for (let i = 0; i < 100; i++) s += waveGap(rng, sector, 15);
    return s / 100;
  };
  assert.ok(avg(4) < avg(1));
});

test("garantia contra azar: chance de cápsula cresce sem cápsula e tem teto", () => {
  assert.ok(killDropChance(10) > killDropChance(0));
  assert.equal(killDropChance(1000), DROPS.pityMax);
  assert.ok(killDropChance(5, 1.5) > killDropChance(5, 1));
});

test("tipo de cápsula acompanha a necessidade da nave", () => {
  const ctx = { t: 30, stress: 0 };
  assert.equal(capsuleWeights(ship({ hp: 3 }), ctx).H, 0, "sem reparo com casco cheio");
  assert.ok(capsuleWeights(ship({ hp: 1 }), ctx).H > capsuleWeights(ship({ hp: 2 }), ctx).H);
  assert.equal(capsuleWeights(ship(), { t: 5 }).D, 0, "drone só depois de 20 s");
  assert.ok(capsuleWeights(ship({ gun: 6 }), ctx).M < capsuleWeights(ship(), ctx).M);
  const rec = capsuleWeights(ship(), { t: 30, recover: { type: "F", until: 40 } });
  assert.ok(Math.abs(rec.F - capsuleWeights(ship(), ctx).F * 3) < 1e-9, "arma perdida volta com peso triplo");
  const rng = createRng(1);
  for (let i = 0; i < 50; i++) assert.notEqual(pickCapsule(rng, ship({ hp: 3 }), ctx), "H");
});

test("cápsula sobe a arma sem teto; reparo com casco cheio avisa que sobrou", () => {
  const p = ship({ gun: 5, rockets: 99, drones: 99 });
  assert.deepEqual(applyCapsule(p, "M"), { level: 6, max: false });
  assert.deepEqual(applyCapsule(p, "M"), { level: 7, max: false });
  assert.deepEqual(applyCapsule(p, "F"), { level: 100, max: false });
  assert.deepEqual(applyCapsule(p, "D"), { level: 100, max: false });
  assert.equal(applyCapsule(p, "H").max, true);
  p.hp = 2;
  assert.equal(applyCapsule(p, "H").level, 3);
  assert.equal(applyCapsule(p, "E").max, false);
  assert.equal(p.shield, true);
});

test("dano tira 1 nível da arma de maior nível; metralhadora nunca abaixo de 1", () => {
  assert.equal(weaponToLose(ship()), null);
  assert.equal(weaponToLose(ship({ gun: 3, rockets: 4 })), "F");
  assert.equal(weaponToLose(ship({ gun: 6, rockets: 1 })), "M");
  assert.equal(weaponToLose(ship({ drones: 3, gun: 2 })), "D");
  assert.equal(weaponToLose(ship({ drones: 2, gun: 2 })), "M", "empate fica com a metralhadora");
  const p = ship({ gun: 1 });
  loseWeapon(p, "M");
  assert.equal(p.gun, 1);
});
