// Ajudantes para controlar o jogo num navegador (Playwright): usados pelo teste
// tests/smoke.mjs e pelo gerador de capturas das lojas scripts/loja.mjs.
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const require = createRequire(import.meta.url);
export const { chromium, devices } = require("playwright");
export const root = fileURLToPath(new URL("..", import.meta.url));

// Sobe o servidor local servindo dist/ e devolve a URL com o gancho de inspeção (?qa).
export async function serveDist(port) {
  const server = spawn(process.execPath, [join(root, "scripts/serve.mjs"), "dist"], {
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
  });
  await new Promise((r) => setTimeout(r, 400));
  return { url: `http://localhost:${port}/?qa`, stop: () => server.kill() };
}

// Espera o bloco chegar a `near` do centro (ou passar de `far`) e solta na hora certa.
export const dropWhen = (page, { near, far }) =>
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

export const screenIs = (page, name) =>
  page.waitForFunction((n) => window.__prumo.screen() === n, name, { timeout: 8000 });

// Grava um progresso no aparelho e recarrega (para abrir fases e o modo Infinito).
export async function setProgress(page, progress) {
  await page.evaluate((p) => localStorage.setItem("prumo.v1", JSON.stringify(p)), progress);
  await page.reload();
  await page.waitForTimeout(600);
}
