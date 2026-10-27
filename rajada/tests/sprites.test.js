import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SPRITES, HD_SPRITES, PALETTE, worldSize, validateSprites, sizeOf, isHd, lapVariant, eliteVariant, spriteNames } from "../src/sprites.js";
import { hdGrid, shade3, rim, dither, finishHD } from "../src/pixel-hd.js";
import { toRows } from "../src/pixel.js";

const fingerprint = (o) => createHash("sha256").update(JSON.stringify(o)).digest("hex");

// Impressão digital dos sprites de baixa resolução que não foram redesenhados
// (os que passaram para alta definição saem da conta).
test("editor movido sem mudar nenhum sprite", () => {
  assert.equal(fingerprint(SPRITES), "1064bd70b6fe284b901812c0b95cd1c56f0c0a12b259fd7d317b25fe47ad8901");
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

const checkHd = (expected) => {
  for (const [name, [w, h, frames]] of Object.entries(expected)) {
    assert.ok(isHd(name), name);
    assert.deepEqual(sizeOf(name), { w, h }, name);
    assert.equal(HD_SPRITES[name].length, frames, name);
    if (frames > 1) assert.equal(new Set(HD_SPRITES[name].map((f) => f.join("\n"))).size, frames, `${name}: quadros diferentes`);
  }
  assert.deepEqual(validateSprites(), []);
};

test("chefes atuais em alta definição mantêm tamanho e caixas", () => {
  checkHd({ colosso: [63, 41, 4], aranha: [59, 46, 4], olho: [49, 47, 3], iris: [11, 11, 1] });
});

test("arte dos chefes novos: Serpente, Forja e Rainha", () => {
  checkHd({ serpente: [26, 22, 2], serpente_gomo: [16, 14, 2], serpente_cauda: [12, 12, 1], forja: [70, 40, 4], rainha: [64, 44, 4] });
});

test("paletas das voltas e contorno de elite só usam cores da paleta", () => {
  const all = [...Object.values(SPRITES), ...Object.values(HD_SPRITES)].flat();
  for (const skin of [1, 2, 3]) {
    for (const rows of all) {
      for (const ch of lapVariant(rows, skin).join("")) assert.ok(ch === "." || PALETTE[ch], `volta ${skin}: cor ${ch}`);
      for (const ch of eliteVariant(rows, skin).join("")) assert.ok(ch === "." || PALETTE[ch], `elite ${skin}: cor ${ch}`);
    }
  }
  const zangao = SPRITES.zangao[0];
  for (const skin of [1, 2, 3]) assert.notDeepEqual(lapVariant(zangao, skin), zangao, `volta ${skin} muda o Zangão`);
  const count = (rows, ch) => rows.join("").split(ch).length - 1;
  const elite = eliteVariant(zangao, 0);
  assert.equal(elite.length, zangao.length + 2, "peça sem contorno ganha um por fora");
  assert.ok(count(elite, "y") > count(zangao, "y") + 10, "contorno dourado na primeira volta");
  const big = HD_SPRITES.couracado[0];
  const bigElite = eliteVariant(big, 0);
  assert.equal(bigElite.length, big.length, "peça com contorno troca a cor dele");
  assert.ok(count(bigElite, "k") < count(big, "k") && count(bigElite, "y") > count(big, "y"));
});

test("cada inimigo tem as variações de volta e de elite", () => {
  const names = spriteNames();
  for (const name of ["zangao", "couracado", "pedra_g", "mina"]) {
    for (const v of ["@1", "@2", "@3", "@elite", "@1@elite", "@3@elite"]) assert.ok(names.includes(name + v), name + v);
  }
});
