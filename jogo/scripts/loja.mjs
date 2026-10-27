// Gera as imagens das lojas a partir do jogo de verdade (precisa de `npm run build`).
// Uso: npm run loja
// loja/capturas/iphone/    1290 x 2796 (App Store, tela de 6,9")
// loja/capturas/android/   1080 x 2160 (Play Store, celular)
// loja/destaque-play.png   1024 x 500  (Play Store, imagem de destaque)
// loja/icone-512.png       512 x 512   (Play Store, ícone)
import { mkdir, readFile, cp } from "node:fs/promises";
import { join } from "node:path";
import { chromium, root, serveDist, dropWhen, screenIs, setProgress } from "./navegador.mjs";
import { PHASES } from "../src/phases.js";

const out = join(root, "loja");
const font = (await readFile(join(root, "fonts/unbounded-latin.woff2"))).toString("base64");
const ALL_DONE = { stars: [3, 3, 3, 3, 3, 3, 3, 3], best: 30, muted: true };
const UPTO = (n) => ({ stars: PHASES.map((_, i) => (i < n ? 3 : 0)), best: 0, muted: true });

async function openPhase(page, i) {
  await page.click("#btn-phases");
  await page.click(`.phase-tile[data-i="${i}"]`);
}

// Formatos: tamanho final (CSS px, a 3x) e área da tela do jogo dentro da arte.
const FORMATS = {
  iphone: { page: [430, 932], screen: [393, 852], frameW: 360, frameTop: 196, caption: 31 },
  android: { page: [360, 720], screen: [360, 780], frameW: 290, frameTop: 150, caption: 25 },
};

// Cada cena deixa o jogo num estado bonito de mostrar; a legenda tem um trecho em destaque.
const SCENES = [
  {
    file: "1-perfeito",
    caption: "Solte o bloco <em>no prumo</em>",
    bg: PHASES[0].bg,
    async play(page) {
      await page.click("#btn-play");
      for (let i = 0; i < 5; i++) await dropWhen(page, { near: 1 });
      await page.waitForTimeout(140);
    },
  },
  {
    file: "2-corte",
    caption: "Errou por pouco? <em>Tente de novo</em>",
    bg: PHASES[1].bg,
    progress: UPTO(1),
    async play(page) {
      await openPhase(page, 1);
      for (let i = 0; i < 3; i++) await dropWhen(page, { near: 1 });
      await dropWhen(page, { near: 45 });
      await page.waitForTimeout(260);
    },
  },
  {
    file: "3-estrelas",
    caption: "Ganhe até <em>3 estrelas</em> por fase",
    bg: PHASES[2].bg,
    progress: UPTO(2),
    async play(page) {
      await openPhase(page, 2);
      for (let i = 0; i < PHASES[2].target; i++) await dropWhen(page, { near: 3 });
      await screenIs(page, "result");
      await page.waitForTimeout(1500);
    },
  },
  {
    file: "4-fases",
    caption: "8 fases com <em>regras novas</em>",
    bg: PHASES[3].bg,
    progress: UPTO(3),
    async play(page) {
      await openPhase(page, 3);
      for (let i = 0; i < 2; i++) await dropWhen(page, { near: 1 });
      // volta a mostrar a apresentação da fase por cima da torre já começada
      await page.evaluate(() => {
        const el = document.getElementById("banner");
        el.hidden = false;
        el.style.animation = "none";
      });
      await page.waitForTimeout(200);
    },
  },
  {
    file: "5-infinito",
    caption: "Até onde você chega <em>no Infinito</em>?",
    bg: ["#2a2459", "#0c0a1f"],
    progress: ALL_DONE,
    async play(page) {
      await page.click("#btn-endless");
      for (let i = 0; i < 27; i++) await dropWhen(page, { near: 3 });
      await page.waitForTimeout(140);
    },
  },
];

async function capture(browser, format, scene, server) {
  const [w, h] = FORMATS[format].screen;
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3, hasTouch: true });
  const page = await context.newPage();
  await page.goto(server.url);
  await setProgress(page, scene.progress ?? UPTO(0));
  await scene.play(page);
  const shot = await page.screenshot();
  await context.close();
  return shot;
}

async function compose(browser, format, scene, shot) {
  const f = FORMATS[format];
  const [w, h] = f.page;
  const context = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 3 });
  const page = await context.newPage();
  await page.setContent(`<style>
    @font-face { font-family: U; src: url(data:font/woff2;base64,${font}); font-weight: 200 900; }
    html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
    body { background: linear-gradient(${scene.bg[0]}, ${scene.bg[1]}); position: relative; }
    h1 { position: absolute; top: 0; left: 0; right: 0; height: ${f.frameTop}px; margin: 0;
      display: grid; place-items: center; padding: 0 26px; box-sizing: border-box; text-align: center;
      font: 800 ${f.caption}px/1.15 U, sans-serif; color: #f3f5fa; text-wrap: balance; letter-spacing: -0.01em; }
    em { font-style: normal; color: #ffcf5c; }
    img { position: absolute; top: ${f.frameTop}px; left: ${(w - f.frameW) / 2}px; width: ${f.frameW}px;
      border-radius: 30px; border: 6px solid #05070d; box-shadow: 0 24px 60px rgba(0,0,0,.45); }
  </style><h1><span>${scene.caption}</span></h1><img src="data:image/png;base64,${shot.toString("base64")}">`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, "capturas", format, `${scene.file}.png`) });
  await context.close();
}

async function featureGraphic(browser) {
  const context = await browser.newContext({ viewport: { width: 1024, height: 500 } });
  const page = await context.newPage();
  const widths = [300, 300, 300, 270, 270, 230];
  const blocks = widths
    .map((bw, i) => `<div class="b" style="width:${bw}px;bottom:${i * 46}px;background:hsl(${192 + i * 2.4} 62% ${55 + i}%)"></div>`)
    .join("");
  await page.setContent(`<style>
    @font-face { font-family: U; src: url(data:font/woff2;base64,${font}); font-weight: 200 900; }
    body { margin: 0; width: 1024px; height: 500px; overflow: hidden; position: relative;
      background: linear-gradient(#173457, #0a1626); font-family: system-ui, sans-serif; color: #f3f5fa; }
    .txt { position: absolute; left: 72px; top: 50%; transform: translateY(-50%); }
    h1 { margin: 0; font: 800 92px/1 U, sans-serif; letter-spacing: .05em; }
    p { margin: 18px 0 0; font-size: 28px; color: rgba(243,245,250,.72); }
    .tower { position: absolute; right: 30px; bottom: 0; width: 360px; height: 420px; }
    .b { position: absolute; left: 30px; height: 42px; border-radius: 4px; box-shadow: inset 0 5px 0 rgba(255,255,255,.22); }
    .base { position: absolute; left: 30px; bottom: -200px; width: 300px; height: 200px; background: hsl(192 62% 45%); }
    .moving { position: absolute; left: 120px; bottom: ${6 * 46 + 4}px; width: 230px; height: 42px; border-radius: 4px;
      background: #ffcf5c; box-shadow: inset 0 5px 0 rgba(255,255,255,.35); }
    .line { position: absolute; left: 145px; top: -80px; width: 1px; height: 140px; background: rgba(255,255,255,.35); }
  </style>
  <div class="txt"><h1>PRUMO</h1><p>Um toque. Uma torre. Só mais uma.</p></div>
  <div class="tower"><div class="line"></div><div class="base"></div>${blocks}<div class="moving"></div></div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(out, "destaque-play.png") });
  await context.close();
}

await mkdir(join(out, "capturas", "iphone"), { recursive: true });
await mkdir(join(out, "capturas", "android"), { recursive: true });
const server = await serveDist(5181);
const browser = await chromium.launch();
try {
  for (const format of Object.keys(FORMATS)) {
    for (const scene of SCENES) {
      await compose(browser, format, scene, await capture(browser, format, scene, server));
      console.log(`${format}/${scene.file}.png`);
    }
  }
  await featureGraphic(browser);
  await cp(join(root, "icons/icon-512.png"), join(out, "icone-512.png"));
  console.log("destaque-play.png, icone-512.png");
} finally {
  await browser.close();
  server.stop();
}
