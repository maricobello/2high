// Imagens para as lojas, tiradas do próprio jogo (build em dist/):
// store/ios-*.png      1290x2796 (iPhone 6,9")
// store/android-*.png  1080x1920 (celular Android)
// store/destaque.png   1024x500  (imagem de destaque da Google Play)
// Uso: npm run build && npm run store
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { mkdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const out = join(root, "store");
const PORT = 5182;

const SHOTS = [
  { id: "1-armas", caption: "Armas que evoluem sem limite" },
  { id: "2-chefe", caption: "Um chefe no fim de cada setor" },
  { id: "3-turbo", caption: "Combos, raspões e TURBO" },
  { id: "4-hangar", caption: "Melhorias e naves novas" },
  { id: "5-missoes", caption: "Missões sob medida para você" },
];

const DEVICES = [
  { prefix: "ios", width: 1290, height: 2796, viewport: { width: 430, height: 932 }, scale: 3 },
  { prefix: "android", width: 1080, height: 1920, viewport: { width: 360, height: 640 }, scale: 3 },
];

await mkdir(out, { recursive: true });
const server = spawn(process.execPath, [join(root, "scripts/serve.mjs"), "dist"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 500));
const font = (await readFile(join(root, "fonts/pixelify-sans-latin.woff2"))).toString("base64");
const browser = await chromium.launch();

// Prepara o jogo num estado bonito para cada captura.
async function scene(page, id) {
  const qa = (fn, arg) => page.evaluate(fn, arg);
  await page.goto(`http://localhost:${PORT}/?qa`);
  await page.waitForTimeout(600);
  await qa(() => {
    const r = window.__rajada;
    const p = r.profile();
    r.setProfile({
      ...p,
      tutorial: true,
      cristais: 1340,
      missionsDone: 7,
      ships: ["faisca", "vespa", "bigorna"],
      upgrades: { ...p.upgrades, canhao: 2, ima: 2, casco: 1, escudo: 1, sorte: 1 },
      stats: { ...p.stats, runs: 42, best: { ...p.stats.best, score: 48210, sector: 4, combo: 6 } },
    });
  });
  if (id === "4-hangar") {
    await page.click("#btn-hangar");
    await page.waitForTimeout(700);
    return;
  }
  if (id === "5-missoes") {
    await page.click("#btn-missions");
    await page.waitForTimeout(1200);
    return;
  }
  await page.click("#btn-play");
  await qa(() => window.__rajada.autopilot(true, 0.95));
  await page.waitForTimeout(400);
  const caps = id === "1-armas" ? ["M", "F"] : ["M", "M", "F", "F", "D", "D"];
  await qa((list) => {
    const r = window.__rajada;
    for (const t of list) r.capsule(t);
  }, caps);
  // armas evoluídas: metralhadora no Raio (tiro violeta), salva de 8 e esquadrilha
  if (id === "1-armas") {
    await qa(() => {
      const r = window.__rajada;
      r.level("M", 27);
      r.level("F", 10);
      r.level("D", 4);
    });
  }
  if (id === "2-chefe") {
    // o Olho, com o laser: o chefe mais vistoso
    await qa(() => {
      window.__rajada.jumpTo(3, 2);
      window.__rajada.skipToBoss();
    });
    await page.waitForFunction(() => window.__rajada.game().boss && !window.__rajada.game().boss.entering, null, { timeout: 20000 });
    await page.waitForFunction(() => window.__rajada.game().lasers.some((l) => l.t > l.warn), null, { timeout: 30000 });
    await page.waitForTimeout(250);
  } else {
    await qa((sector) => window.__rajada.jumpTo(sector), id === "1-armas" ? 8 : 4);
    await page.waitForTimeout(2500);
    const waves = id === "1-armas" ? ["v", "atiradores", "couracado"] : ["pinca", "couracado", "dardos"];
    if (id === "3-turbo") {
      await qa(() => {
        const g = window.__rajada.game();
        g.turboT = 6;
        g.mult = 6;
      });
    }
    for (const w of waves) await qa((name) => window.__rajada.wave(name), w);
    // foto quando a onda já entrou e ainda não foi destruída
    await page.waitForTimeout(1300);
  }
  await qa(() => {
    window.__rajada.autopilot(false);
    document.getElementById("toast").hidden = true;
  });
}

for (const d of DEVICES) {
  const context = await browser.newContext({ viewport: d.viewport, deviceScaleFactor: d.scale, hasTouch: true, isMobile: true });
  for (const shot of SHOTS) {
    const page = await context.newPage();
    await scene(page, shot.id);
    const raw = await page.screenshot({ type: "png" });
    await page.close();
    // moldura: legenda em cima, tela do jogo embaixo
    const comp = await context.newPage();
    await comp.setViewportSize({ width: d.width / d.scale, height: d.height / d.scale });
    await comp.setContent(`<style>
      @font-face{font-family:P;src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:400 700}
      html,body{margin:0;height:100%}
      body{background:linear-gradient(#1a2a66,#05070f 55%);font-family:P;color:#f4f7ff;display:flex;flex-direction:column;align-items:center;overflow:hidden}
      h1{margin:9% 7% 5%;font-size:${d.prefix === "ios" ? 40 : 30}px;line-height:1.1;text-align:center;letter-spacing:.02em}
      h1 b{color:#ffd23f}
      img{width:82%;border-radius:18px;box-shadow:0 0 0 3px #2c3f86,0 18px 60px rgba(0,0,0,.6)}
    </style><h1>${shot.caption.replace(/(TURBO|chefe|cápsulas|naves novas|sob medida)/, "<b>$1</b>")}</h1>
    <img src="data:image/png;base64,${raw.toString("base64")}">`);
    await comp.waitForTimeout(250);
    await comp.screenshot({ path: join(out, `${d.prefix}-${shot.id}.png`), type: "png", omitBackground: false });
    await comp.close();
  }
  await context.close();
}

// Destaque da Google Play (1024x500, sem transparência).
const og = (await readFile(join(root, "og.png"))).toString("base64");
const page = await browser.newPage({ viewport: { width: 1024, height: 500 } });
await page.setContent(`<style>html,body{margin:0;background:#05070f}img{width:1024px;height:500px;object-fit:cover}</style>
  <img src="data:image/png;base64,${og}">`);
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, "destaque.png") });

await browser.close();
server.kill();
console.log(`imagens das lojas em ${out}`);
