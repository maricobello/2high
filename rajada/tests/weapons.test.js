import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gunVolley,
  gunInterval,
  gunBeam,
  rocketSpec,
  rocketLaunch,
  steerRocket,
  pickTarget,
  droneSpec,
  droneVolley,
  estimateDps,
} from "../src/weapons.js";
import { weaponToLose } from "../src/drops.js";
import { validateSprites } from "../src/sprites.js";

test("metralhadora: canos por nível até a Tempestade, nunca mais de 9", () => {
  assert.deepEqual(
    [1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 200].map((l) => gunVolley(l, 100, 300).length),
    [1, 2, 3, 4, 5, 7, 7, 7, 6, 9, 9],
  );
});

test("nível 200 funciona e bate mais que o 199", () => {
  assert.ok(gunVolley(200, 0, 0)[0].dmg > gunVolley(199, 0, 0)[0].dmg);
});

test("Perfurante atravessa, Caçadora tem 2 teleguiados, Raio tem feixe", () => {
  assert.equal(gunVolley(14, 0, 0)[0].pierce, 0);
  assert.equal(gunVolley(15, 0, 0)[0].pierce, 1);
  assert.equal(gunVolley(20, 0, 0).filter((b) => b.homing).length, 2);
  assert.equal(gunBeam(24), null);
  assert.equal(gunBeam(25).width, 4);
});

test("cor do tiro acompanha a faixa", () => {
  assert.equal(gunVolley(12, 0, 0)[0].band, 2);
  assert.equal(gunVolley(50, 0, 0)[0].band, 10);
});

test("cadência vai de 0,125 a 0,075 e para no 30; turbo pela metade", () => {
  assert.equal(gunInterval(1), 0.125);
  assert.ok(Math.abs(gunInterval(30) - 0.075) < 1e-9);
  assert.equal(gunInterval(90), gunInterval(30));
  assert.equal(gunInterval(7, true), gunInterval(7) * 0.5);
});

test("Tempestade balança o leque: rajadas pares e ímpares abrem para lados opostos", () => {
  const even = gunVolley(30, 100, 300, 0).map((b) => b.vx);
  const odd = gunVolley(30, 100, 300, 1).map((b) => b.vx);
  assert.ok(even[0] > 0 && odd[0] < 0, "o cano do meio aponta +6° e depois −6°");
  assert.deepEqual(gunVolley(12, 0, 0, 0), gunVolley(12, 0, 0, 1), "antes do 30 todas as rajadas são iguais");
});

test("tiros sobem e o leque abre para os dois lados por igual", () => {
  const v = gunVolley(5, 100, 300);
  for (const b of v) assert.ok(b.vy < 0);
  const vxs = v.map((b) => b.vx).sort((a, b) => a - b);
  assert.ok(Math.abs(vxs[0] + vxs.at(-1)) < 1e-9);
});

test("foguetes: 1, 2, 2, 4, 6, 8 e fragmentação no 15", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10, 15, 100].map((l) => rocketLaunch(l, 0, 0).length), [1, 2, 2, 4, 6, 8, 8, 8]);
  assert.equal(rocketSpec(14).frag, 0);
  assert.equal(rocketSpec(15).frag, 4);
  assert.equal(rocketSpec(100).splash, 24);
});

test("foguetes: nenhum sem nível, saindo dos dois lados, cada um com o dano do nível", () => {
  assert.deepEqual(rocketLaunch(0, 0, 0), []);
  const eight = rocketLaunch(10, 100, 300);
  assert.equal(eight.filter((r) => r.x < 100).length, 4);
  for (const r of eight) assert.equal(r.dmg, rocketSpec(10).dmg);
  assert.ok(rocketSpec(11).dmg > rocketSpec(10).dmg);
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

test("drones: até 4, cadência até 2×, raio no 10", () => {
  assert.equal(droneSpec(7).count, 4);
  assert.equal(droneSpec(100).every, 0.09);
  assert.equal(droneSpec(10).beam, true);
  assert.equal(droneVolley(12, 0, 0).length, 0);
});

test("drone atira um tiro até o nível 4 e dois em leque do 5 ao 9", () => {
  assert.equal(droneVolley(4, 0, 0).length, 1);
  assert.equal(droneVolley(5, 0, 0).length, 2);
  assert.equal(droneVolley(9, 0, 0).length, 2);
});

test("estimativa de dano por segundo soma as armas e cresce com cada nível", () => {
  const base = { gun: 1, rockets: 0, drones: 0 };
  assert.ok(Math.abs(estimateDps(base) - 8) < 1e-9, "1 tiro de dano 1 a cada 0,125 s");
  assert.ok(estimateDps({ ...base, rockets: 1 }) > estimateDps(base));
  assert.ok(estimateDps({ ...base, drones: 1 }) > estimateDps(base));
  assert.ok(estimateDps({ gun: 25, rockets: 0, drones: 0 }) > estimateDps({ gun: 24, rockets: 0, drones: 0 }), "o raio entra na conta");
  assert.ok(estimateDps({ ...base, drones: 10 }) > estimateDps({ ...base, drones: 9 }), "o raio dos drones entra na conta");
});

test("ao levar dano perde a arma de maior nível (empate: metralhadora)", () => {
  assert.equal(weaponToLose({ gun: 12, rockets: 12, drones: 3 }), "M");
  assert.equal(weaponToLose({ gun: 3, rockets: 7, drones: 2 }), "F");
  assert.equal(weaponToLose({ gun: 1, rockets: 0, drones: 0 }), null);
});

test("todos os sprites têm quadros do mesmo tamanho e cores da paleta", () => {
  assert.deepEqual(validateSprites(), []);
});
