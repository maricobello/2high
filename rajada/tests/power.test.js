import { test } from "node:test";
import assert from "node:assert/strict";
import { bandOf, starsOf, damageMult, gunForm, nextMilestone, weaponLabel, rampOf } from "../src/power.js";

test("faixa de cor muda nos marcos e vira arco-íris no 50", () => {
  assert.deepEqual([1, 4, 5, 9, 10, 45, 49, 50, 51, 500].map(bandOf), [0, 0, 1, 1, 2, 9, 9, 10, 10, 10]);
});

test("estrelas a partir do 35, uma a cada 5 níveis", () => {
  assert.deepEqual([34, 35, 39, 40, 87].map(starsOf), [0, 1, 1, 2, 11]);
});

test("dano cresce a cada nível, sem teto", () => {
  assert.equal(damageMult(1), 1);
  assert.ok(Math.abs(damageMult(11) - 2) < 1e-9);
  for (let lv = 2; lv <= 300; lv++) assert.ok(damageMult(lv) > damageMult(lv - 1));
});

test("formas da metralhadora nos níveis certos", () => {
  assert.deepEqual(
    [1, 4, 5, 10, 15, 20, 25, 30, 35, 200].map((l) => gunForm(l).id),
    ["rajada", "rajada", "leque", "pesada", "perfurante", "cacadora", "raio", "tempestade", "estelar", "estelar"],
  );
});

test("próximo marco: forma até o 30, depois estrela", () => {
  assert.deepEqual(nextMilestone(4), { at: 5, label: "Leque", missing: 1 });
  assert.deepEqual(nextMilestone(12), { at: 15, label: "Perfurante", missing: 3 });
  assert.deepEqual(nextMilestone(33), { at: 35, label: "★1", missing: 2 });
  assert.deepEqual(nextMilestone(40), { at: 45, label: "★3", missing: 5 });
});

test("rótulo do placar cabe num celular estreito", () => {
  assert.equal(weaponLabel(12), "12");
  assert.equal(weaponLabel(87), "87★11");
  for (const lv of [1, 34, 35, 99, 999]) assert.ok(weaponLabel(lv).length <= 7);
});

test("arco-íris troca de rampa com o tempo; faixas normais não", () => {
  assert.deepEqual(rampOf(3, 0), rampOf(3, 5));
  assert.notDeepEqual(rampOf(10, 0), rampOf(10, 0.1));
});
