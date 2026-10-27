import { test } from "node:test";
import assert from "node:assert/strict";
import {
  placeBlock,
  grownWidth,
  sliderPosition,
  starThresholds,
  starsFor,
  defaultProgress,
  applyPhaseResult,
  applyEndlessResult,
  isPhaseUnlocked,
  isEndlessUnlocked,
  nextPhaseToPlay,
  endlessRules,
  sanitizeProgress,
} from "../src/core.js";

test("perfeito: dentro da tolerância encaixa no centro sem cortar", () => {
  const r = placeBlock({ x: 0, w: 100 }, { x: 3, w: 100 }, 4);
  assert.equal(r.kind, "perfect");
  assert.deepEqual(r.block, { x: 0, w: 100 });
});

test("corte à direita: mantém a sobreposição e solta o resto", () => {
  const r = placeBlock({ x: 0, w: 100 }, { x: 30, w: 100 }, 4);
  assert.equal(r.kind, "cut");
  assert.deepEqual(r.block, { x: 15, w: 70 });
  assert.deepEqual(r.debris, { x: 65, w: 30 });
  assert.equal(r.kept, 0.7);
});

test("corte à esquerda: espelho do caso à direita", () => {
  const r = placeBlock({ x: 10, w: 80 }, { x: -10, w: 80 }, 2);
  assert.equal(r.kind, "cut");
  assert.deepEqual(r.block, { x: 0, w: 60 });
  assert.deepEqual(r.debris, { x: -40, w: 20 });
});

test("errou tudo: sem sobreposição é derrota", () => {
  assert.equal(placeBlock({ x: 0, w: 50 }, { x: 50, w: 50 }, 2).kind, "miss");
  assert.equal(placeBlock({ x: 0, w: 50 }, { x: -70, w: 50 }, 2).kind, "miss");
});

test("recuperação: só a partir do 3º perfeito seguido, sem passar da base", () => {
  assert.equal(grownWidth(100, 2, 200, 10), 100);
  assert.equal(grownWidth(100, 3, 200, 10), 110);
  assert.equal(grownWidth(195, 5, 200, 10), 200);
});

test("movimento linear: começa na ponta, cruza o centro e volta", () => {
  assert.equal(sliderPosition(0, 100, "linear"), -100);
  assert.equal(sliderPosition(0.25, 100, "linear"), 0);
  assert.equal(sliderPosition(0.5, 100, "linear"), 100);
  assert.equal(sliderPosition(1, 100, "linear"), -100);
});

test("movimento senoidal: mesmas pontas que o linear", () => {
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);
  near(sliderPosition(0, 100, "sine"), -100);
  near(sliderPosition(0.25, 100, "sine"), 0);
  near(sliderPosition(0.5, 100, "sine"), 100);
});

test("estrelas: 1 por concluir, 2 e 3 por perfeitos", () => {
  assert.deepEqual(starThresholds(10), [4, 7]);
  assert.equal(starsFor(0, 10), 1);
  assert.equal(starsFor(4, 10), 2);
  assert.equal(starsFor(7, 10), 3);
});

test("progresso: concluir libera a próxima e guarda a melhor nota", () => {
  let p = defaultProgress(8);
  assert.equal(isPhaseUnlocked(p, 0), true);
  assert.equal(isPhaseUnlocked(p, 1), false);
  p = applyPhaseResult(p, 0, 2);
  assert.equal(isPhaseUnlocked(p, 1), true);
  p = applyPhaseResult(p, 0, 1);
  assert.equal(p.stars[0], 2);
});

test("progresso: não altera o objeto original", () => {
  const p = defaultProgress(8);
  applyPhaseResult(p, 0, 3);
  assert.equal(p.stars[0], 0);
});

test("infinito: libera após a fase 3 e guarda o recorde", () => {
  let p = defaultProgress(8);
  assert.equal(isEndlessUnlocked(p), false);
  p = applyPhaseResult(applyPhaseResult(applyPhaseResult(p, 0, 1), 1, 1), 2, 1);
  assert.equal(isEndlessUnlocked(p), true);
  p = applyEndlessResult(p, 25);
  p = applyEndlessResult(p, 12);
  assert.equal(p.best, 25);
});

test("próxima fase: a primeira sem estrela, ou a última se tudo concluído", () => {
  let p = defaultProgress(3);
  assert.equal(nextPhaseToPlay(p), 0);
  p = applyPhaseResult(p, 0, 1);
  assert.equal(nextPhaseToPlay(p), 1);
  p = applyPhaseResult(applyPhaseResult(p, 1, 1), 2, 1);
  assert.equal(nextPhaseToPlay(p), 2);
});

test("infinito: fica mais difícil com a altura, com teto de velocidade", () => {
  const low = endlessRules(0);
  const high = endlessRules(200);
  assert.ok(high.speed > low.speed);
  assert.equal(low.easing, "linear");
  assert.equal(low.sway, 0);
  assert.ok(high.sway > 0);
  assert.ok(high.jitter > 0);
  assert.equal(endlessRules(10000).speed, endlessRules(1000).speed);
});

test("dados salvos inválidos voltam ao padrão sem quebrar", () => {
  assert.deepEqual(sanitizeProgress(null, 8), defaultProgress(8));
  assert.deepEqual(sanitizeProgress({ stars: "x", best: -3 }, 8), defaultProgress(8));
  const p = sanitizeProgress({ stars: [3, 9, -1], best: 12.7, muted: true }, 4);
  assert.deepEqual(p.stars, [3, 3, 0, 0]);
  assert.equal(p.best, 12);
  assert.equal(p.muted, true);
});
