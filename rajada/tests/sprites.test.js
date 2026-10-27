import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SPRITES, HD_SPRITES, worldSize, validateSprites } from "../src/sprites.js";
import { hdGrid, shade3, rim, dither, finishHD } from "../src/pixel-hd.js";
import { toRows } from "../src/pixel.js";

const fingerprint = (o) => createHash("sha256").update(JSON.stringify(o)).digest("hex");

test("editor movido sem mudar nenhum sprite", () => {
  assert.equal(fingerprint(SPRITES), "e2b4950ba60f41e68c6cd100afbf1717b524cc4b2c363dc17d07cbe03b60bf23");
});

test("sprite HD mede metade da grade no mundo", () => {
  const rows = ["....", "....", "....", "...."];
  assert.deepEqual(worldSize(rows, true), { w: 2, h: 2 });
  assert.deepEqual(worldSize(rows, false), { w: 4, h: 4 });
});

test("nenhum nome existe nos dois registros e todos os sprites são válidos", () => {
  for (const name of Object.keys(HD_SPRITES)) assert.ok(!(name in SPRITES), name);
  assert.deepEqual(validateSprites(), []);
});

test("grade HD tem o dobro de pixels por unidade do mundo", () => {
  const G = hdGrid(3, 2);
  assert.equal(G.length, 4);
  assert.equal(G[0].length, 6);
});

test("pontilhado alterna as duas cores em xadrez", () => {
  const G = hdGrid(2, 2);
  dither(G, 0, 0, 4, 2, "b", "n");
  assert.deepEqual(toRows(G).slice(0, 2), ["bnbn", "nbnb"]);
});

test("sombra em 3 tons clareia em cima e escurece embaixo", () => {
  const G = hdGrid(4, 4);
  for (let y = 1; y < 7; y++) for (let x = 1; x < 7; x++) G[y][x] = "b";
  shade3(G);
  const rows = toRows(G);
  assert.notEqual(rows[1][3], "b", "borda de cima clareou");
  assert.notEqual(rows[6][3], "b", "borda de baixo escureceu");
  assert.equal(rows[3][3], "b", "miolo fica na cor base");
});

test("brilho e contorno fecham a peça", () => {
  const G = hdGrid(4, 4);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) G[y][x] = "g";
  rim(G, "w");
  assert.ok(toRows(G).join("").includes("w"), "brilho na borda iluminada");
  const out = finishHD(hdGrid(4, 4).map((r, y) => r.map((c, x) => (y > 1 && y < 6 && x > 1 && x < 4 ? "l" : c))), { sym: true });
  assert.equal(out[1][2], "k", "contorno em cima");
  for (const row of out) {
    for (let x = 0; x < row.length; x++) assert.equal(row[x] === ".", row[row.length - 1 - x] === ".", "silhueta espelhada");
  }
});
