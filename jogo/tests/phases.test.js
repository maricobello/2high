import { test } from "node:test";
import assert from "node:assert/strict";
import { PHASES } from "../src/phases.js";

test("8 fases com nomes únicos", () => {
  assert.equal(PHASES.length, 8);
  assert.equal(new Set(PHASES.map((p) => p.name)).size, PHASES.length);
});

test("dificuldade nunca diminui de uma fase para a seguinte", () => {
  for (let i = 1; i < PHASES.length; i++) {
    assert.ok(PHASES[i].target >= PHASES[i - 1].target, `meta da fase ${i + 1}`);
    assert.ok(PHASES[i].speed >= PHASES[i - 1].speed, `velocidade da fase ${i + 1}`);
    assert.ok(PHASES[i].tolerance <= PHASES[i - 1].tolerance, `margem da fase ${i + 1}`);
  }
});

test("cada fase tem os campos que o jogo usa, com valores válidos", () => {
  for (const p of PHASES) {
    assert.ok(p.hint.length > 0 && p.hint.length <= 48, `dica curta: ${p.name}`);
    assert.ok(["linear", "sine"].includes(p.easing));
    assert.ok(p.startWidth > 0 && p.startWidth <= 1);
    assert.ok(p.sway >= 0 && p.jitter >= 0 && p.jitter < 1);
    assert.ok(p.tolerance > 0);
    assert.equal(p.bg.length, 2);
  }
});
