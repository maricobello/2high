// Teste de ponta a ponta no navegador: abre o build, joga e confere as telas.
// Uso: npm run build && npm run smoke  (prints em tests/prints/)
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import assert from "node:assert/strict";
import { chromium, devices, root, serveDist, dropWhen, screenIs, setProgress } from "../scripts/navegador.mjs";

const shots = join(root, "tests/prints");
await mkdir(shots, { recursive: true });
const server = await serveDist(5180);

async function run(label, context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(server.url);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(shots, `${label}-1-inicio.png`) });

  // fase 1 com perfeitos: conclui com 3 estrelas
  await page.click("#btn-play");
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(shots, `${label}-2-fase.png`) });
  for (let i = 0; i < 10; i++) assert.ok(await dropWhen(page, { near: 2 }), `bloco ${i + 1}`);
  await screenIs(page, "result");
  await page.waitForTimeout(1400);
  assert.equal(await page.textContent("#res-title"), "Fase concluída");
  assert.equal(await page.locator("#res-stars svg.on").count(), 3);
  await page.screenshot({ path: join(shots, `${label}-3-vitoria.png`) });

  // fase 2: um corte grande e depois um erro
  await page.click("#res-primary");
  await screenIs(page, "game");
  await dropWhen(page, { near: 2 });
  await dropWhen(page, { near: 2 });
  await dropWhen(page, { far: 120 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(shots, `${label}-4-corte.png`) });
  await dropWhen(page, { far: 170 });
  await screenIs(page, "result");
  assert.match(await page.textContent("#res-title"), /^Falta/);
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(shots, `${label}-5-derrota.png`) });

  // tocar em qualquer lugar recomeça
  await page.mouse.click(20, 200);
  await screenIs(page, "game");

  // pausa
  await page.keyboard.press("Escape");
  await screenIs(page, "pause");
  await page.screenshot({ path: join(shots, `${label}-6-pausa.png`) });
  await page.click("#btn-pause-menu");
  await screenIs(page, "home");

  // Infinito liberado (progresso salvo como se as fases 1 a 3 estivessem feitas)
  await setProgress(page, { stars: [3, 2, 1, 0, 0, 0, 0, 0], best: 6, muted: false });
  await page.screenshot({ path: join(shots, `${label}-7-inicio-progresso.png`) });
  await page.click("#btn-phases");
  await screenIs(page, "phases");
  assert.equal(await page.locator(".phase-tile:not([disabled])").count(), 4);
  await page.screenshot({ path: join(shots, `${label}-7b-fases.png`) });
  await page.click("#btn-phases-close");
  await screenIs(page, "home");
  assert.equal(await page.isDisabled("#btn-endless"), false);
  await page.click("#btn-endless");
  for (let i = 0; i < 8; i++) await dropWhen(page, { near: 2 });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(shots, `${label}-8-infinito.png`) });
  await dropWhen(page, { far: 170 });
  await dropWhen(page, { far: 170 });
  await screenIs(page, "result");
  assert.equal(await page.textContent("#res-title"), "Novo recorde: 9");
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(shots, `${label}-9-recorde.png`) });

  assert.deepEqual(errors, [], `erros no console (${label})`);
  await page.close();
  console.log(`ok ${label}`);
}

const browser = await chromium.launch();
try {
  await run("computador", await browser.newContext({ viewport: { width: 1280, height: 800 } }));
  await run("celular", await browser.newContext({ ...devices["iPhone 13"] }));
} finally {
  await browser.close();
  server.stop();
}
