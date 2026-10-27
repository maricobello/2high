// Gera o ícone e as imagens do app a partir da pixel art (src/sprites.js).
// Rodar quando a arte mudar: `npm run icons`, depois
// `npx capacitor-assets generate --android --ios` para os apps nativos.
// icon.svg            ícone do site
// icons/              PNG do site (PWA e iPhone)
// assets/             origem dos ícones e da abertura nativos (@capacitor/assets)
// og.png              imagem de compartilhamento (1200x630)
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { build } from "esbuild";
import { SPRITES, PALETTE } from "../src/sprites.js";
import { SHIPS } from "../src/config.js";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));

// Sprite em retângulos SVG (um por pixel, sem borrar).
function rects(name, frame, left, top, px) {
  const rows = SPRITES[name][frame];
  let out = "";
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch !== ".") out += `<rect x="${left + x * px}" y="${top + y * px}" width="${px}" height="${px}" fill="${PALETTE[ch]}"/>`;
    });
  });
  return out;
}

// Nave com chamas e rajada de tiros acima, centrada em cx.
function art(cx, top, px) {
  const ship = SPRITES.faisca[0];
  const left = cx - (ship[0].length * px) / 2;
  let out = "";
  const bullet = (x, y) => (out += rects("tiro", 0, x - px, y, px * 0.9));
  const nose = top - px * 2;
  for (const [dx, dy] of [
    [0, 4],
    [0, 8.5],
    [-2.6, 5],
    [2.6, 5],
    [-5, 9],
    [5, 9],
  ]) {
    bullet(cx + dx * px, nose - dy * px);
  }
  for (const [ex, ey] of SHIPS.faisca.engines) out += rects("chama", 1, left + ex * px, top + ey * px, px);
  out += rects("faisca", 0, left, top, px);
  return out;
}

const STARS = [
  [70, 90, 6],
  [430, 70, 6],
  [110, 300, 4],
  [400, 250, 4],
  [60, 430, 6],
  [460, 410, 4],
  [300, 40, 4],
  [180, 470, 4],
];

function iconSvg({ radius = 112, scale = 1, background = true, foreground = true, glow = true } = {}) {
  const px = 15 * scale;
  const top = 256 - (14 * px) / 2 + 30 * scale;
  const bg = background
    ? `<rect width="512" height="512" rx="${radius}" fill="url(#bg)"/>${STARS.map(([x, y, s]) => `<rect x="${x}" y="${y}" width="${s}" height="${s}" fill="#9fb4ff" opacity=".7"/>`).join("")}`
    : "";
  const halo = glow ? `<circle cx="256" cy="${top + 7 * px}" r="${150 * scale}" fill="url(#glow)"/>` : "";
  const fg = foreground ? `${halo}${art(256, top, px)}` : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" shape-rendering="crispEdges">
<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a2a66"/><stop offset="1" stop-color="#05070f"/></linearGradient>
<radialGradient id="glow"><stop offset="0" stop-color="#48e4f0" stop-opacity=".32"/><stop offset="1" stop-color="#48e4f0" stop-opacity="0"/></radialGradient>
</defs>
${bg}${fg}
</svg>
`;
}

await writeFile(join(root, "icon.svg"), iconSvg());

const browser = await chromium.launch();
const page = await browser.newPage();

async function shot(file, w, h, markup, transparent = false) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(
    `<style>html,body{margin:0;background:${transparent ? "transparent" : "#05070f"}}svg{display:block;width:100vw;height:100vh}</style>${markup}`,
  );
  await page.screenshot({ path: join(root, file), omitBackground: transparent });
}

await mkdir(join(root, "icons"), { recursive: true });
await mkdir(join(root, "assets"), { recursive: true });
const square = iconSvg({ radius: 0 });
await shot("icons/icon-180.png", 180, 180, square);
await shot("icons/icon-192.png", 192, 192, square);
await shot("icons/icon-512.png", 512, 512, square);
await shot("icons/icon-maskable-512.png", 512, 512, iconSvg({ radius: 0, scale: 0.78 }));
await shot("assets/icon-only.png", 1024, 1024, square);
await shot("assets/icon-foreground.png", 1024, 1024, iconSvg({ radius: 0, scale: 0.7, background: false }), true);
await shot("assets/icon-background.png", 1024, 1024, iconSvg({ radius: 0, foreground: false }));

// Abertura e imagem de compartilhamento: HTML com a fonte e os sprites do jogo.
const font = (await readFile(join(root, "fonts/pixelify-sans-latin.woff2"))).toString("base64");
const js = (
  await build({
    stdin: {
      contents: `import { buildSprites } from "./src/sprites.js";
        const s = buildSprites((w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }));
        for (const el of document.querySelectorAll("[data-spr]")) {
          const [name, frame, px] = el.dataset.spr.split(":");
          const src = s[name].frames[Number(frame)];
          el.width = src.width * Number(px);
          el.height = src.height * Number(px);
          const ctx = el.getContext("2d");
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(src, 0, 0, el.width, el.height);
        }`,
      resolveDir: root,
    },
    bundle: true,
    write: false,
    format: "iife",
  })
).outputFiles[0].text;

const base = `<style>@font-face{font-family:P;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:400 700}
html,body{margin:0}body{font-family:P;color:#f4f7ff;overflow:hidden}
.word{font-weight:700;color:#ffd23f;letter-spacing:.06em;line-height:1;text-shadow:0 .06em 0 #c96a00,0 .12em 0 #7a2c00}
canvas{position:absolute;image-rendering:pixelated}</style>`;

// fundo liso: a abertura vai em vários tamanhos dentro dos apps e precisa ser leve
const splash = `${base}<div style="width:2732px;height:2732px;position:relative;background:#05070f">
<div style="position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);width:720px;height:720px">${iconSvg({ background: false, glow: false })}</div>
<div class="word" style="position:absolute;left:0;right:0;top:62%;text-align:center;font-size:190px">RAJADA</div></div>
<script>${js}</script>`;
await page.setViewportSize({ width: 2732, height: 2732 });
await page.setContent(splash);
await page.waitForTimeout(300);
await page.screenshot({ path: join(root, "assets/splash.png") });
await page.screenshot({ path: join(root, "assets/splash-dark.png") });

const og = `${base}<div style="width:1200px;height:630px;position:relative;background:linear-gradient(#16245a,#05070f)">
${STARS.map(([x, y, s]) => `<div style="position:absolute;left:${x * 2.2}px;top:${y * 1.2}px;width:${s}px;height:${s}px;background:#9fb4ff;opacity:.6"></div>`).join("")}
<div style="position:absolute;left:70px;top:150px">
<div class="word" style="font-size:132px">RAJADA</div>
<div style="margin-top:44px;font-size:40px">Só mais uma rajada.</div>
<div style="margin-top:14px;font-size:28px;color:#b9c3dc">Nave retrô de um dedo · grátis no navegador</div></div>
<canvas data-spr="colosso:0:5" style="left:820px;top:40px"></canvas>
<canvas data-spr="zangao:0:6" style="left:780px;top:290px"></canvas>
<canvas data-spr="zangao:1:6" style="left:1090px;top:270px"></canvas>
<canvas data-spr="bolha:0:6" style="left:900px;top:300px"></canvas>
<canvas data-spr="bolha:0:6" style="left:990px;top:330px"></canvas>
<canvas data-spr="cap_M:0:6" style="left:1060px;top:420px"></canvas>
<canvas data-spr="cap_F:0:6" style="left:760px;top:420px"></canvas>
<div style="position:absolute;left:830px;top:300px;width:300px;height:300px">${iconSvg({ background: false, scale: 0.9 })}</div>
</div><script>${js}</script>`;
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(og);
await page.waitForTimeout(300);
await page.screenshot({ path: join(root, "og.png") });

await browser.close();
console.log("ícones, abertura e og.png gerados");
