// Desempenho no pior caso, num celular modesto simulado (CPU 4× mais lenta):
// Forja na fase 2 (setor 11), metralhadora 40, foguetes 20, drones 9, ondas de
// inimigos que não morrem (repostas quando sobram menos de 35) e nave sem levar
// dano, até a tela encher de tiros (teto de 220 tiros inimigos). Mede quadros
// por segundo por 10 s e o tempo de buildSprites. Falha se a cena não chegar ao
// pior caso (200 tiros inimigos, 150 da nave, 40 inimigos), se a média ficar
// abaixo de 58 qps ou se os sprites passarem de 300 ms (S10).
// Uso: npm run build && npm run perf
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
const root = fileURLToPath(new URL("..", import.meta.url));
const PORT = 5182;

const server = spawn(process.execPath, [join(root, "scripts/serve.mjs"), "dist"], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: "ignore",
});
await new Promise((r) => setTimeout(r, 500));

const browser = await chromium.launch();
let failed = false;
try {
  const context = await browser.newContext({ ...devices["iPhone 13"] });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(`http://localhost:${PORT}/?qa`);
  await page.waitForFunction(() => window.__rajada, null, { timeout: 20000 });
  const spriteMs = await page.evaluate(() => window.__rajada.spriteMs);

  // pior caso: muita coisa na tela ao mesmo tempo
  await page.evaluate(() => {
    const r = window.__rajada;
    r.setProfile({ ...r.profile(), tutorial: true, stats: { ...r.profile().stats, runs: 3 } });
  });
  await page.click("#btn-play");
  await page.waitForFunction(() => window.__rajada.screen() === "game", null, { timeout: 20000 });
  await page.evaluate(() => {
    const r = window.__rajada;
    r.jumpTo(11, 10); // Forja: ondas de fogo na fase 2
    r.skipToBoss();
    r.autopilot(true, 0.9);
    r.level("M", 40);
    r.level("F", 20);
    r.level("D", 9); // drones ainda com tiro (do 10 em diante viram raio): mais tiros na tela
  });
  await page.waitForFunction(() => window.__rajada.game().boss && !window.__rajada.game().boss.entering, null, { timeout: 60000 });
  await page.evaluate(() => {
    const r = window.__rajada;
    const g = r.game();
    g.boss.maxHp *= 100;
    g.boss.hp = g.boss.maxHp * 0.45; // fase 2, e sem morrer durante a medida
    g.player.hp = g.player.maxHp = 99;
    // inimigos que não morrem, ondas novas quando sobram menos de 35 e nave sem
    // levar dano: a tela enche e fica cheia
    const waves = ["enxame", "couracado", "atiradores", "minas", "pedras", "chuva", "pinca"];
    let last = -9;
    const keep = () => {
      const now = r.game();
      if (!now) return;
      now.player.inv = 5;
      if (now.enemies.length < 35 && now.t - last > 1.5) {
        last = now.t;
        for (const id of waves) r.wave(id);
      }
      for (const e of now.enemies) if (e.hp < 500) e.hp = e.maxHp = 1e6;
      requestAnimationFrame(keep);
    };
    requestAnimationFrame(keep);
  });
  await page.waitForTimeout(1500);

  const { perSecond, peak } = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const counts = [];
        const peak = { enemies: 0, shots: 0, bullets: 0 };
        let n = 0;
        let start = 0;
        let second = 0;
        const tick = (now) => {
          if (!start) start = second = now;
          n += 1;
          const g = window.__rajada.game();
          for (const k of Object.keys(peak)) peak[k] = Math.max(peak[k], g[k].length);
          if (now - second >= 1000) {
            counts.push(n);
            n = 0;
            second = now;
          }
          if (now - start < 10000) requestAnimationFrame(tick);
          else resolve({ perSecond: counts, peak });
        };
        requestAnimationFrame(tick);
      }),
  );
  const state = await page.evaluate(() => {
    const g = window.__rajada.game();
    return { enemies: g.enemies.length, shots: g.shots.length, bullets: g.bullets.length, boss: g.boss?.name, phase: g.boss?.phase };
  });
  const avg = perSecond.reduce((a, b) => a + b, 0) / perSecond.length;
  const worst = Math.min(...perSecond);
  console.log(`fps médio ${avg.toFixed(1)} · pior segundo ${worst} · spriteMs ${spriteMs.toFixed(0)} · pico ${JSON.stringify(peak)} · ${JSON.stringify(state)}`);
  if (errors.length) console.log("erros:", errors);
  const full = peak.shots >= 200 && peak.bullets >= 150 && peak.enemies >= 40;
  if (!full) console.log("a cena não chegou ao pior caso (tela cheia de tiros)");
  failed = !full || avg < 58 || spriteMs > 300 || errors.length > 0;
  console.log(failed ? "FALHOU (meta: tela cheia, média ≥ 58 qps e sprites ≤ 300 ms)" : "ok desempenho");
} finally {
  await browser.close();
  server.kill();
}
process.exit(failed ? 1 : 0);
