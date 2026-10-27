// Teste de ponta a ponta no navegador: abre o build, joga, pega cápsula,
// enfrenta chefe, perde, recomeça, compra no hangar e confere as telas.
// Uso: npm run build && npm run smoke  (prints em tests/prints/)
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const shots = join(root, "tests/prints");
const PORT = 5181;
const URL_QA = `http://localhost:${PORT}/?qa`;

await mkdir(shots, { recursive: true });
const server = spawn(process.execPath, [join(root, "scripts/serve.mjs"), "dist"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 500));

const screenIs = (page, name, timeout = 15000) =>
  page.waitForFunction((n) => window.__rajada.screen() === n, name, { timeout });
const game = (page, fn) => page.evaluate(`(${fn})(window.__rajada.game())`);

async function run(label, context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  const snap = (name) => page.screenshot({ path: join(shots, `${label}-${name}.png`) });

  await page.goto(URL_QA);
  await page.waitForTimeout(1500);
  await snap("1-inicio");
  assert.equal(await page.textContent("#play-sub"), "Primeiro voo");

  // primeira partida: dica de arrastar e cápsulas garantidas
  await page.click("#btn-play");
  await screenIs(page, "game");
  assert.equal(await page.isVisible("#hint"), true, "dica de arrastar na primeira partida");
  // canvas com o dobro de pixels por dentro e sem borrar
  const canvasState = () =>
    page.evaluate(() => {
      const c = document.getElementById("stage");
      return { w: c.width, smooth: c.getContext("2d").imageSmoothingEnabled };
    });
  assert.deepEqual(await canvasState(), { w: 448, smooth: false });
  const before = await game(page, (g) => g.player.x);
  if (label === "celular") {
    // arrastar com o dedo move a nave na mesma direção
    const box = await page.locator("#frame").boundingBox();
    const cdp = await context.newCDPSession(page);
    const touch = (type, x) =>
      cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y: box.y + box.height * 0.8 }] });
    await touch("touchStart", box.x + 200);
    for (let x = 200; x >= 120; x -= 10) await touch("touchMove", box.x + x);
    await touch("touchEnd");
  } else {
    await page.keyboard.down("ArrowLeft");
    await page.waitForTimeout(400);
    await page.keyboard.up("ArrowLeft");
  }
  await page.waitForTimeout(200);
  assert.ok((await game(page, (g) => g.player.x)) < before - 20, "a nave andou para a esquerda");
  await page.evaluate(() => window.__rajada.autopilot(true, 0.9));
  await page.waitForTimeout(6000);
  await snap("2-partida");
  // girar a tela no meio da partida não muda a resolução nem borra
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.height, height: vp.width });
  await page.waitForTimeout(400);
  assert.deepEqual(await canvasState(), { w: 448, smooth: false }, "depois de girar a tela");
  await page.setViewportSize(vp);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const r = window.__rajada;
    r.capsule("M");
    r.capsule("F");
    r.capsule("D");
  });
  await page.waitForTimeout(300);
  const p = await game(page, (g) => ({ gun: g.player.gun, rockets: g.player.rockets, drones: g.player.drones }));
  assert.ok(p.gun >= 2 && p.rockets >= 1 && p.drones >= 1, JSON.stringify(p));
  assert.ok((await page.locator("#hud-weapons span").count()) >= 3, "HUD mostra as armas");

  // pausa
  await page.keyboard.press("Escape");
  await screenIs(page, "pause");
  await snap("3-pausa");
  await page.click("#btn-resume");
  await screenIs(page, "game");

  // chefe
  await page.evaluate(() => window.__rajada.skipToBoss());
  await page.waitForFunction(() => window.__rajada.game().boss && !window.__rajada.game().boss.entering, null, { timeout: 15000 });
  // vida alta: com as armas sem teto o chefe cairia antes das checagens abaixo
  await game(page, (g) => (g.boss.hp = g.boss.maxHp = g.boss.maxHp * 50));
  await page.waitForTimeout(2500);
  assert.equal(await page.isVisible("#hud-boss"), true, "barra de vida do chefe");
  await snap("4-chefe");

  // armas sem teto: nível com estrela no placar, próximo marco e cápsula lendária
  await game(page, (g) => (g.player.inv = 3));
  await page.evaluate(() => window.__rajada.level("M", 37));
  await page.waitForTimeout(300);
  assert.equal(await page.textContent('#hud-weapons [data-w="M"]'), "37★1");
  assert.equal(await page.textContent("#hud-next"), "faltam 3 para ★2");
  await page.evaluate(() => window.__rajada.capsule("M", "lendaria"));
  await page.waitForTimeout(500);
  assert.equal(await page.textContent('#hud-weapons [data-w="M"]'), "40★2");
  assert.equal(await page.textContent("#hud-next"), "faltam 5 para ★3");
  await snap("armas");

  // volta 2 (paleta dourada) com elites: as variações nascem na hora e desenham sem erro
  await page.evaluate(() => {
    const r = window.__rajada;
    r.jumpTo(16);
    for (const id of ["enxame", "couracado", "pedras", "atiradores"]) r.wave(id);
  });
  await page.waitForTimeout(1800);
  assert.ok(await game(page, (g) => g.enemies.some((e) => e.elite) || g.stats.kills > 0), "inimigos da volta 2 em jogo");
  await snap("voltas");

  // derrota: casco a zero
  await page.evaluate(() => window.__rajada.autopilot(false));
  for (let i = 0; i < 10 && (await page.evaluate(() => window.__rajada.screen())) === "game"; i++) {
    await page.evaluate(() => window.__rajada.hurt());
    await page.waitForTimeout(150);
  }
  await screenIs(page, "result");
  await page.waitForTimeout(1200);
  await snap("5-resultado");
  assert.equal(await page.textContent("#res-title"), "Primeiro voo");
  assert.ok(Number((await page.textContent("#res-cristais")).replace(/\D/g, "")) > 0, "ganhou cristais");
  assert.equal(await page.locator("#res-missions .mission").count(), 3);

  // hangar a partir do resultado: compra com cristais
  await page.evaluate(() => {
    const r = window.__rajada;
    r.setProfile({ ...r.profile(), cristais: 500 });
  });
  await page.click("#res-hangar");
  await screenIs(page, "hangar");
  const buy = page.locator('[data-buy="ima"]');
  await buy.click();
  assert.equal(await page.evaluate(() => window.__rajada.profile().upgrades.ima), 1);
  await snap("6-hangar");
  await page.click("#tab-btn-naves");
  await snap("6b-naves");
  await page.click("#tab-btn-registro");
  await snap("6c-registro");
  await page.click("#btn-hangar-close");
  await screenIs(page, "result");

  // tocar fora do cartão recomeça
  await page.waitForTimeout(800);
  const frame = await page.locator("#frame").boundingBox();
  await page.mouse.click(frame.x + 4, frame.y + 4);
  await screenIs(page, "game");
  assert.equal(await page.isVisible("#hint"), false, "dica só na primeira partida");

  // recorde de nível da metralhadora avisa na hora
  const record = await page.evaluate(() => window.__rajada.profile().stats.best.gun);
  assert.ok(record >= 37, `recorde guardado: ${record}`);
  await page.evaluate((n) => {
    window.__rajada.level("M", n);
    window.__rajada.capsule("M");
  }, record);
  await page.waitForFunction((n) => document.getElementById("toast").textContent.includes(`Recorde: metralhadora nível ${n + 1}`), record, { timeout: 4000 });

  // volta ao início, missões e ajustes
  await page.keyboard.press("Escape");
  await screenIs(page, "pause");
  await page.click("#btn-pause-home");
  await screenIs(page, "home");
  await page.waitForTimeout(600);
  await snap("7-inicio-progresso");
  assert.match(await page.textContent("#play-sub"), /^Recorde /);
  await page.click("#btn-missions");
  await screenIs(page, "missions");
  await snap("8-missoes");
  await page.click("#btn-missions-close");
  await page.click("#btn-settings");
  await screenIs(page, "settings");
  await page.click('#settings .toggle[data-key="music"]');
  assert.equal(await page.evaluate(() => window.__rajada.profile().settings.music), false);
  await snap("9-ajustes");
  await page.click("#btn-settings-close");
  await screenIs(page, "home");

  // coleção de chefes e formas, aberta pela tela inicial
  await page.click("#btn-collection");
  await screenIs(page, "collection");
  const small = await page.evaluate(() =>
    [...document.querySelectorAll("#collection button, #btn-collection")]
      .map((b) => b.getBoundingClientRect())
      .filter((r) => r.width < 44 || r.height < 44).length,
  );
  assert.equal(small, 0, "botões com pelo menos 44 px");
  assert.equal(await page.locator("#collection .col-boss").count(), 6);
  await page.waitForTimeout(300);
  await snap("colecao");
  await page.click("#btn-collection-close");
  await screenIs(page, "home");

  // progresso sobrevive ao recarregar
  await page.reload();
  await page.waitForTimeout(800);
  assert.equal(await page.evaluate(() => window.__rajada.profile().upgrades.ima), 1);
  assert.equal(await page.evaluate(() => window.__rajada.profile().settings.music), false);

  assert.deepEqual(errors, [], `erros no console (${label})`);
  await page.close();
  console.log(`ok ${label}`);
}

// Efeitos: print com movimento normal (rastro dos tiros, cápsula lendária com
// anel e faíscas) e 20 s em cada modo, inclusive "reduzir movimento", sem erro
// e sem clarão de tela inteira mais de 3 vezes por segundo.
async function effects(browser) {
  for (const reducedMotion of ["no-preference", "reduce"]) {
    const context = await browser.newContext({ ...devices["iPhone 13"], reducedMotion });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(URL_QA);
    await page.waitForTimeout(800);
    await page.click("#btn-play");
    await screenIs(page, "game");
    await page.evaluate(() => {
      const r = window.__rajada;
      r.autopilot(true, 0.9);
      r.level("M", 40);
      r.level("F", 15);
      r.level("D", 4);
    });
    await game(page, (g) => (g.player.hp = g.player.maxHp = 99));
    await page.waitForTimeout(1500);
    await game(page, (g) => g.items.push({ kind: "cap", type: "E", rarity: "lendaria", x: g.player.x, y: g.player.y - 70, t: 0 }));
    await page.waitForTimeout(450);
    if (reducedMotion === "no-preference") await page.screenshot({ path: join(shots, "efeitos.png") });
    const before = await page.evaluate(() => window.__rajada.fx().flashes);
    await page.waitForTimeout(20000);
    const flashes = (await page.evaluate(() => window.__rajada.fx().flashes)) - before;
    assert.ok(flashes <= 3 * 20 + 1, `${flashes} clarões em 20 s (${reducedMotion})`);
    assert.deepEqual(errors, [], `erros no console (efeitos, ${reducedMotion})`);
    await context.close();
  }
  console.log("ok efeitos");
}

const browser = await chromium.launch();
try {
  await run("computador", await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await run("celular", await browser.newContext({ ...devices["iPhone 13"] }));
  await effects(browser);
} finally {
  await browser.close();
  server.kill();
}
