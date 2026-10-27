// Folha de prévia de todos os sprites (ampliados), para conferir a pixel art.
// Uso: npm run sprites  → tests/prints/sprites.png
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const scale = Number(process.argv[2] ?? 6);

const entry = `
import { buildSprites, SPRITES } from "./src/sprites.js";
const sprites = buildSprites((w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h }));
const S = ${scale};
const sheet = document.getElementById("sheet");
for (const name of Object.keys(SPRITES)) {
  const s = sprites[name];
  const cell = document.createElement("figure");
  for (const set of [s.frames, s.flipped].filter(Boolean)) {
    for (const f of set) {
      const c = document.createElement("canvas");
      c.width = f.width * S; c.height = f.height * S;
      const ctx = c.getContext("2d");
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(f, 0, 0, c.width, c.height);
      cell.append(c);
    }
  }
  const cap = document.createElement("figcaption");
  cap.textContent = name + " " + s.w + "x" + s.h;
  cell.append(cap);
  sheet.append(cell);
}
`;

const js = (
  await build({ stdin: { contents: entry, resolveDir: root }, bundle: true, write: false, format: "iife" })
).outputFiles[0].text;

const html = `<!doctype html><style>
body{margin:0;background:#070b16;color:#b9c3dc;font:12px monospace}
#sheet{display:flex;flex-wrap:wrap;gap:14px;padding:14px;width:${Math.round(1400)}px}
figure{margin:0;display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap;padding:8px;background:#0d1426;border-radius:6px}
figcaption{width:100%}
canvas{image-rendering:pixelated}
</style><div id="sheet"></div><script>${js}</script>`;

await mkdir(join(root, "tests/prints"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1430, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.setContent(html);
await page.waitForTimeout(200);
const out = join(root, "tests/prints/sprites.png");
await page.locator("#sheet").screenshot({ path: out });
await browser.close();
if (errors.length) throw new Error(errors.join("\n"));
console.log(out);
