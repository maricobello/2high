// Piloto automático: joga na tela inicial e no simulador de balanceamento.
// Avalia posições candidatas em volta da nave: perigo dos tiros e inimigos
// previstos para os próximos instantes, mais atração por cápsulas, cristais
// e por ficar embaixo dos inimigos (para acertá-los). skill de 0 a 1 controla
// quanto ele enxerga à frente, o tempo de reação e o erro de mira.
import { createRng, clamp } from "./rng.js";
import { PLAYER } from "./config.js";

export function createBot({ skill = 0.7, seed = 99 } = {}) {
  const rng = createRng(seed);
  const look = 0.15 + 0.6 * skill; // s de previsão
  const reaction = 0.34 - 0.26 * skill; // s entre decisões
  const noise = 18 * (1 - skill); // px de erro
  const care = 0.6 + 0.8 * skill; // peso do perigo
  const sight = 30 + 70 * skill; // px: tiros mais longe que isso passam despercebidos
  const samples = skill < 0.5 ? [0, 0.5] : [0, 0.5, 1]; // novato prevê pouco
  let cooldown = 0;
  let target = null;

  function danger(g, x, y) {
    let d = 0;
    const p = g.player;
    for (const s of g.shots) {
      if (Math.abs(s.x - x) > 50 || s.y - y > 30 || y - s.y > 160) continue;
      if (Math.hypot(s.x - p.x, s.y - p.y) > sight) continue;
      for (const k of samples) {
        const t = look * k;
        const dx = s.x + s.vx * t - x;
        const dy = s.y + s.vy * t - y;
        const r = s.r + p.hitR + 4;
        const dist2 = dx * dx + dy * dy;
        if (dist2 < r * r * 9) d += (r * r * 9) / (dist2 + 4);
      }
    }
    for (const e of g.enemies) {
      const rx = e.def.box[0] / 2 + 8;
      const ry = e.def.box[1] / 2 + 8;
      for (const k of [0.25, 0.6, 1]) {
        const t = look * k;
        const dx = e.x + e.vx * t - x;
        const dy = e.y + e.vy * t - y;
        if (Math.abs(dx) < rx && Math.abs(dy) < ry) d += 4;
      }
      // dardo mirando: a linha até a nave vai virar o caminho do mergulho
      if (e.move === "dive" && e.state !== "dive") {
        const lx = p.x - e.x;
        const ly = p.y - e.y;
        const len = Math.hypot(lx, ly) || 1;
        const across = Math.abs((x - e.x) * ly - (y - e.y) * lx) / len;
        if (across < 16 && y > e.y) d += 5 * (1 - across / 16);
      }
    }
    for (const l of g.lasers) {
      const dx = x - l.x;
      const dy = y - l.y;
      const from = l.t < l.warn ? l.from : l.angle;
      for (const u of [0, 0.5, 1]) {
        const ang = from + (l.to - from) * u;
        const across = Math.abs(-dx * Math.sin(ang) + dy * Math.cos(ang));
        const along = dx * Math.cos(ang) + dy * Math.sin(ang);
        if (along > 0 && across < 18) d += 8 * (1 - across / 18);
      }
    }
    if (g.boss) {
      const b = g.boss;
      if (Math.abs(b.x - x) < b.box[0] / 2 + 10 && Math.abs(b.y - y) < b.box[1] / 2 + 14) d += 12;
    }
    return d;
  }

  function desire(g, x, y) {
    let v = 0;
    for (const it of g.items) {
      const dist = Math.hypot(it.x - x, it.y - y);
      v += (it.kind === "cap" ? 2.5 : 0.4) / (1 + dist / 30);
    }
    // ficar embaixo de alguém para acertar (mirando à frente de quem anda)
    let aim = 0;
    for (const e of g.enemies) {
      if (e.y < 0 || e.y > y) continue;
      const lead = e.x + (e.vx ?? 0) * ((y - e.y) / 330);
      const worth = e.type === "portador" ? 2.2 : e.type === "couracado" ? 1.2 : 1;
      const range = e.type === "portador" ? 140 : 24;
      aim = Math.max(aim, worth * (1 - Math.min(1, Math.abs(lead - x) / range)));
    }
    if (g.boss) aim = Math.max(aim, 1 - Math.min(1, Math.abs(g.boss.x - x) / 30));
    v += aim * 1.2;
    // preferência leve pela parte de baixo e pelo centro
    v += (y / g.H) * 0.4 - (Math.abs(x - g.W / 2) / g.W) * 0.3;
    return v;
  }

  function think(g) {
    const p = g.player;
    let best = null;
    let bestScore = -Infinity;
    const reach = 26;
    for (let i = -2; i <= 2; i++) {
      for (let j = -2; j <= 2; j++) {
        const x = clamp(p.x + i * reach * 0.6, 7, g.W - 7);
        const y = clamp(p.y + j * reach * 0.5, g.H * PLAYER.topLimit, g.H - PLAYER.bottomMargin);
        const score = desire(g, x, y) - care * danger(g, x, y) - Math.hypot(x - p.x, y - p.y) * 0.004;
        if (score > bestScore) {
          bestScore = score;
          best = { x, y };
        }
      }
    }
    return best;
  }

  return {
    // Chame a cada quadro; ele decide de tempos em tempos e mira a nave.
    drive(g, dt) {
      cooldown -= dt;
      if (cooldown <= 0 || !target) {
        cooldown = reaction * rng.range(0.7, 1.3);
        // distração: de vez em quando o piloto demora a reagir
        if (rng.chance((1 - skill) * 0.03)) cooldown += rng.range(0.4, 0.9);
        const t = think(g);
        // dedo de verdade: o lugar escolhido nunca é atingido com precisão de pixel
        target = { x: t.x + rng.range(-noise, noise), y: t.y + rng.range(-noise, noise) * 0.6 };
      }
      g.aimAt(target.x, target.y);
    },
  };
}
