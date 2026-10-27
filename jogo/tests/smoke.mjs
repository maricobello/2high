// Teste de ponta a ponta no navegador: abre o build, joga e confere as telas.
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
const PORT = 5180;
const URL_QA = `http://localhost:${PORT}/?qa`;

await mkdir(shots, { recursive: true });
const server = spawn(process.execPath, [join(root, "scripts/serve.mjs"), "dist"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 400));

// Espera o bloco chegar a `dist` do centro (ou passar de `far`) e solta na hora certa.
const dropWhen = (page, { near, far }) =>
  page.evaluate(
    async ({ near, far }) => {
      const g = window.__prumo.game();
      for (let i = 0; i < 2000; i++) {
        const o = Math.abs(g.offset());
        if (g.moving && g.moving.p > 0.1 && ((near !== undefined && o < near) || (far !== undefined && o > far))) {
          document.getElementById("app").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, button: 0 }));
          return true;
        }
        await new Promise(requestAnimationFrame);
      }
      return false;
    },
    { near, far },
  );

const screenIs = (page, name) => page.waitForFunction((n) => window.__prumo.screen() === n, name, { timeout: 8000 });

async function run(label, context) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

  await page.goto(URL_QA);
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
  await page.evaluate(() =>
    localStorage.setItem("prumo.v1", JSON.stringify({ stars: [3, 2, 1, 0, 0, 0, 0, 0], best: 6, muted: false })),
  );
  await page.reload();
  await page.waitForTimeout(800);
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
  server.kill();
}
