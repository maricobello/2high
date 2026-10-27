import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SPRITES, HD_SPRITES, worldSize, validateSprites, sizeOf, isHd } from "../src/sprites.js";
import { hdGrid, shade3, rim, dither, finishHD } from "../src/pixel-hd.js";
import { toRows } from "../src/pixel.js";

const fingerprint = (o) => createHash("sha256").update(JSON.stringify(o)).digest("hex");

// Impressão digital dos sprites de baixa resolução que não foram redesenhados
// (os que passaram para alta definição saem da conta).
test("editor movido sem mudar nenhum sprite", () => {
  assert.equal(fingerprint(SPRITES), "59e56b92c725abf82a423575d578d7ce3d04ede194dfd89d1d9b52c0f025fc7b");
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

test("inimigos grandes em alta definição mantêm o tamanho no mundo", () => {
  const expected = { couracado: [27, 23, 2], portador: [17, 9, 2], pedra_g: [17, 17, 4] };
  for (const [name, [w, h, frames]] of Object.entries(expected)) {
    assert.ok(isHd(name), name);
    assert.deepEqual(sizeOf(name), { w, h }, name);
    assert.equal(HD_SPRITES[name].length, frames, name);
    const distinct = new Set(HD_SPRITES[name].map((f) => f.join("\n")));
    assert.equal(distinct.size, frames, `${name}: quadros diferentes entre si`);
  }
  assert.deepEqual(validateSprites(), []);
});
