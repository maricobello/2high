import { test } from "node:test";
import assert from "node:assert/strict";
import { gunVolley, gunInterval, rocketLaunch, steerRocket, pickTarget, droneVolley, GUN_MAX } from "../src/weapons.js";
import { validateSprites } from "../src/sprites.js";

test("metralhadora ganha uma fileira por nível até 5 e fica mais rápida", () => {
  const counts = [1, 2, 3, 4, 5, 6].map((lv) => gunVolley(lv, 100, 300).length);
  assert.deepEqual(counts, [1, 2, 3, 4, 5, 5]);
  for (let lv = 2; lv <= GUN_MAX; lv++) assert.ok(gunInterval(lv) <= gunInterval(lv - 1));
  assert.ok(gunVolley(6, 0, 0)[0].dmg > gunVolley(5, 0, 0)[0].dmg, "nível máximo bate mais forte");
});

test("tiros sobem e o leque abre para os dois lados por igual", () => {
  const v = gunVolley(5, 100, 300);
  for (const b of v) assert.ok(b.vy < 0);
  const vxs = v.map((b) => b.vx).sort((a, b) => a - b);
  assert.ok(Math.abs(vxs[0] + vxs.at(-1)) < 1e-9);
});

test("turbo dobra a cadência e nível fora da faixa não quebra", () => {
  assert.equal(gunInterval(3, true), gunInterval(3) * 0.5);
  assert.equal(gunVolley(0, 0, 0).length, 1);
  assert.equal(gunVolley(99, 0, 0).length, 5);
});

test("foguetes: nenhum sem nível, quatro no máximo, saindo dos dois lados", () => {
  assert.deepEqual(rocketLaunch(0, 0, 0), []);
  const four = rocketLaunch(4, 100, 300);
  assert.equal(four.length, 4);
  assert.equal(four.filter((r) => r.x < 100).length, 2);
});

test("foguete vira para o alvo sem passar do limite de giro, acelera e chega", () => {
  const r = { x: 100, y: 300, angle: -Math.PI / 2, speed: 50, life: 2 };
  const target = { x: 200, y: 260 };
  steerRocket(r, target, 0.1);
  assert.ok(r.angle > -Math.PI / 2 && r.angle <= -Math.PI / 2 + 0.5 + 1e-9);
  assert.ok(r.speed > 50);
  let closest = Infinity;
  for (let i = 0; i < 120; i++) {
    steerRocket(r, target, 1 / 120);
    closest = Math.min(closest, Math.hypot(target.x - r.x, target.y - r.y));
  }
  assert.ok(closest < 6, `chegou a ${closest.toFixed(1)} px`);
});

test("alvo do foguete: o inimigo mais perto e vivo, de preferência acima", () => {
  const r = { x: 100, y: 300 };
  const above = { x: 100, y: 200, hp: 3 };
  const below = { x: 100, y: 330, hp: 3 };
  const dead = { x: 100, y: 290, hp: 0 };
  assert.equal(pickTarget(r, [below, above, dead], null), above);
  assert.equal(pickTarget(r, [], null), null);
});

test("drone atira dois tiros quando a metralhadora passa do nível 3", () => {
  assert.equal(droneVolley(2, 0, 0).length, 1);
  assert.equal(droneVolley(4, 0, 0).length, 2);
});

test("todos os sprites têm quadros do mesmo tamanho e cores da paleta", () => {
  assert.deepEqual(validateSprites(), []);
});
