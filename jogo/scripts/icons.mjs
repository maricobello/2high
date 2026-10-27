// Gera os PNG do ícone e da abertura a partir de icon.svg (usa o Playwright).
// Rodar só quando o ícone mudar: `node scripts/icons.mjs`.
// icons/      ícones do site (PWA e iPhone)
// assets/     origem para `npx @capacitor/assets generate` (ícones e splash nativos)
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const svg = await readFile(join(root, "icon.svg"), "utf8");
const square = svg.replace('rx="112"', 'rx="0"');

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(file, size, markup, background = "transparent") {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>html,body{margin:0;background:${background}}svg{display:block;width:100vw;height:100vh}</style>${markup}`,
  );
  await page.screenshot({ path: join(root, file), omitBackground: background === "transparent" });
}

await mkdir(join(root, "icons"), { recursive: true });
await mkdir(join(root, "assets"), { recursive: true });
await shot("icons/icon-180.png", 180, square);
await shot("icons/icon-192.png", 192, square);
await shot("icons/icon-512.png", 512, square);
await shot("assets/icon-only.png", 1024, square);

// Abertura: fundo da fase 1 com o ícone pequeno no centro.
const splash = `<div style="width:100vw;height:100vh;display:grid;place-items:center;background:linear-gradient(#173457,#0a1626)">
  <div style="width:22vw;height:22vw">${svg}</div></div>`;
await shot("assets/splash.png", 2732, splash, "#0a1626");
await shot("assets/splash-dark.png", 2732, splash, "#0a1626");

await browser.close();
console.log("ícones gerados");
