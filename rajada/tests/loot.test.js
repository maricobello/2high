import { test } from "node:test";
import assert from "node:assert/strict";
import { newPity, rarityWeights, rollRarity, levelGain } from "../src/loot.js";
import { applyCapsule } from "../src/drops.js";
import { createRng } from "../src/rng.js";

test("chance por origem segue a tabela", () => {
  const rng = createRng(3);
  const count = { comum: 0, rara: 0, epica: 0, lendaria: 0 };
  for (let i = 0; i < 10000; i++) count[rollRarity(rng, "inimigo", newPity())] += 1;
  assert.ok(Math.abs(count.comum / 10000 - 0.88) <= 0.01);
  assert.ok(Math.abs(count.rara / 10000 - 0.11) <= 0.01);
  for (let i = 0; i < 2000; i++) assert.notEqual(rollRarity(rng, "couracado", newPity()), "comum");
});

const zero = { next: () => 0 }; // sempre o primeiro peso que não é zero

test("depois de 6 comuns seguidas, a próxima é rara ou melhor", () => {
  const pity = newPity();
  const got = Array.from({ length: 7 }, () => rollRarity(zero, "inimigo", pity));
  assert.deepEqual(got.slice(0, 6), Array(6).fill("comum"));
  assert.equal(got[6], "rara");
});

test("pelo menos uma lendária a cada 3 chefes", () => {
  const pity = newPity();
  const got = Array.from({ length: 9 }, () => rollRarity(zero, "chefe1", pity));
  assert.deepEqual(got, ["epica", "epica", "lendaria", "epica", "epica", "lendaria", "epica", "epica", "lendaria"]);
});

test("Sorte tira 2 pontos da comum por nível, até 40%", () => {
  assert.ok(Math.abs(rarityWeights("inimigo", 1)[0] - 0.86) < 1e-9);
  assert.equal(rarityWeights("inimigo", 30)[0], 0.4);
  assert.ok(Math.abs(rarityWeights("inimigo", 7).reduce((a, b) => a + b) - 1) < 1e-9);
});

test("lendária leva até o próximo marco, no mínimo +3", () => {
  assert.equal(levelGain("lendaria", "M", 12), 3);
  assert.equal(levelGain("lendaria", "M", 14), 3);
  assert.equal(levelGain("lendaria", "M", 15), 5);
});

test("épica de suporte dá +1 em todas as armas mesmo com casco e escudo cheios", () => {
  const p = { gun: 3, rockets: 0, drones: 0, hp: 3, maxHp: 3, shield: true };
  assert.deepEqual(applyCapsule(p, "H", "epica").gained, { M: 1, F: 1, D: 1 });
});

test("comum de metralhadora no 4 vira Leque e avisa a forma", () => {
  assert.equal(applyCapsule({ gun: 4, rockets: 0, drones: 0, hp: 3, maxHp: 3 }, "M", "comum").form, "Leque");
});

test("marcos de foguete e drone e estrelas da metralhadora também avisam", () => {
  const ship = (o) => ({ gun: 1, rockets: 0, drones: 0, hp: 3, maxHp: 3, ...o });
  assert.equal(applyCapsule(ship({ rockets: 4 }), "F").form, "Salva de 6");
  assert.equal(applyCapsule(ship({ drones: 3 }), "D").form, "Esquadrilha");
  assert.equal(applyCapsule(ship({ gun: 39 }), "M").form, "★2");
  assert.equal(applyCapsule(ship({ gun: 34 }), "M").form, "Estelar");
  assert.equal(applyCapsule(ship({ gun: 6 }), "M").form, null);
});

test("raridade do suporte: rara dá 20 de TURBO, lendária enche", () => {
  const ship = () => ({ gun: 2, rockets: 1, drones: 0, hp: 2, maxHp: 3, shield: false });
  const rara = applyCapsule(ship(), "E", "rara");
  assert.equal(rara.turbo, 20);
  assert.deepEqual(rara.gained, {});
  const p = ship();
  const lend = applyCapsule(p, "H", "lendaria");
  assert.equal(lend.turbo, "cheio");
  assert.deepEqual(lend.gained, { M: 1, F: 1, D: 1 });
  assert.equal(p.hp, 3);
  assert.equal(applyCapsule(ship(), "M", "rara").turbo, 0, "arma rara não dá TURBO, dá +2");
  assert.deepEqual(applyCapsule(ship(), "M", "rara").gained, { M: 2 });
});
