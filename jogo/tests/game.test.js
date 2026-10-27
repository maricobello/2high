import { test } from "node:test";
import assert from "node:assert/strict";
import { createGame, BASE_W } from "../src/game.js";
import { PHASES } from "../src/phases.js";
import { noteFor } from "../src/audio.js";

const DT = 1 / 240;

// Avança até o bloco ficar a menos de `dist` unidades do centro da torre.
function waitForCenter(g, dist = 1) {
  for (let i = 0; i < 4000; i++) {
    g.update(DT);
    if (Math.abs(g.offset()) < dist) return;
  }
  throw new Error("bloco nunca chegou perto do centro");
}

function play(phase, mode = "phase") {
  const events = [];
  const g = createGame({
    mode,
    phase,
    random: () => 0.5,
    onEvent: (type, data) => events.push({ type, data, height: g.height }),
  });
  return { g, events };
}

test("soltar no centro é perfeito e mantém a largura", () => {
  const { g, events } = play(PHASES[0]);
  waitForCenter(g);
  g.drop();
  assert.equal(events[0].type, "perfect");
  assert.equal(g.height, 1);
  assert.equal(g.blocks[1].w, BASE_W);
});

test("o evento do bloco chega com a altura já contada", () => {
  const { g, events } = play(PHASES[0]);
  waitForCenter(g);
  g.drop();
  waitForCenter(g, 40);
  g.drop();
  assert.deepEqual(events.map((e) => [e.type, e.height]), [["perfect", 1], ["cut", 2]]);
});

test("soltar cedo corta o bloco e zera o combo", () => {
  const { g, events } = play(PHASES[0]);
  waitForCenter(g);
  g.drop();
  for (let i = 0; i < 30; i++) g.update(DT);
  g.drop();
  assert.equal(events[1].type, "cut");
  assert.equal(g.combo, 0);
  assert.ok(g.blocks[2].w < BASE_W);
  assert.equal(g.debris.length, 1);
});

test("chegar à meta conclui a fase com estrelas", () => {
  const { g, events } = play({ ...PHASES[0], target: 3 });
  for (let i = 0; i < 3; i++) {
    waitForCenter(g);
    g.drop();
  }
  assert.equal(g.status, "won");
  const won = events.find((e) => e.type === "won");
  assert.equal(won.data.stars, 3);
  assert.equal(g.drop(), false);
});

test("errar tudo derruba o bloco e avisa a derrota depois da queda", () => {
  const { g, events } = play(PHASES[0]);
  waitForCenter(g);
  g.drop();
  // espera o bloco ficar no ponto mais distante, fora da torre
  for (let i = 0; i < 4000 && Math.abs(g.offset()) < 174; i++) g.update(DT);
  g.blocks[1].w = 20;
  g.moving.w = 20;
  g.drop();
  assert.equal(g.status, "falling");
  assert.equal(events.at(-1).type, "miss");
  for (let i = 0; i < 240; i++) g.update(DT);
  assert.equal(g.status, "lost");
  assert.deepEqual(events.at(-1).data, { height: 1, remaining: 9, best: 0 });
});

test("terceiro perfeito seguido devolve largura até o limite inicial", () => {
  const { g } = play(PHASES[5]);
  const start = g.blocks[0].w;
  waitForCenter(g, 40);
  g.drop();
  const narrowed = g.blocks.at(-1).w;
  for (let i = 0; i < 3; i++) {
    waitForCenter(g);
    g.drop();
  }
  assert.ok(g.blocks.at(-1).w > narrowed);
  assert.ok(g.blocks.at(-1).w <= start);
});

test("modo infinito não termina por meta e acelera com a altura", () => {
  const { g } = play(undefined, "endless");
  const speed0 = g.rules.speed;
  for (let i = 0; i < 25; i++) {
    waitForCenter(g);
    g.drop();
  }
  assert.equal(g.status, "playing");
  assert.ok(g.rules.speed > speed0);
});

test("melodia do combo sobe nota a nota e para de subir no teto", () => {
  assert.ok(noteFor(1, 220) > noteFor(0, 220));
  assert.equal(noteFor(0, 220), 220);
  assert.equal(noteFor(5, 220), 440);
  assert.equal(noteFor(40, 220), noteFor(14, 220));
});
