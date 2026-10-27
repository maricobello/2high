// Desenho no canvas em baixa resolução (224 px de largura), ampliado sem
// borrar pelo CSS. Fundo com degradê pontilhado, nebulosas, planeta e três
// camadas de estrelas; depois itens, inimigos, chefe, tiros e efeitos.
// Os efeitos (partículas, explosões, textos) nascem dos eventos da partida.
import { buildSprites } from "./sprites.js";
import { drawText, textWidth } from "./font.js";
import { W, SHIPS, SHOTS, POWER, RARITY, LAPS, sectorInfo, lapOf, lapSkin } from "./config.js";
import { CAP_NAMES } from "./drops.js";
import { bandOf, rampOf } from "./power.js";

// Pixels de canvas por unidade do mundo: o mundo continua com 224 de largura,
// mas o canvas tem o dobro por dentro para os sprites em alta definição.
export const RES = 2;

const BAYER = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

const DEBRIS = {
  zangao: ["#4ee36a", "#1d8f45", "#ffd23f"],
  dardo: ["#ff3d55", "#9c1a33", "#f4f7ff"],
  atirador: ["#a46bff", "#5a2fae", "#7cb4ff"],
  couracado: ["#7a849f", "#464e6a", "#ff8a2a", "#ffd23f"],
  pedra_g: ["#8c6f5a", "#5a4032", "#c09a7a"],
  pedra_m: ["#8c6f5a", "#5a4032", "#c09a7a"],
  pedra_p: ["#8c6f5a", "#5a4032"],
  mina: ["#ff3d55", "#9c1a33", "#ffd23f"],
  portador: ["#ffd23f", "#ff8a2a", "#fff4b0"],
  nave: ["#f4f7ff", "#7cb4ff", "#3d6bff", "#ff8a2a", "#ffd23f"],
  chefe: ["#7a849f", "#f4f7ff", "#ff8a2a", "#ffd23f", "#ff3d55"],
};

const CAP_COLORS = { M: "#ffd23f", F: "#ff8a2a", D: "#4ee36a", E: "#48e4f0", H: "#ff5fb4", P: "#a46bff" };
const CAP_LABEL = { M: "METRALHADORA", F: "FOGUETES", D: "DRONE", E: "ESCUDO", H: "REPARO", P: "PULSO" };
const RARITY_NAME = { rara: "RARA", epica: "ÉPICA", lendaria: "LENDÁRIA" };

// Texto da cápsula pega: "METRALHADORA +2", "LENDÁRIA · LEQUE", "ÉPICA · REPARO".
function capLabel(d) {
  const gain = d.gained?.[d.type];
  if (gain) {
    const base = `${CAP_LABEL[d.type]} +${gain}`;
    return d.rarity === "lendaria" ? `LENDÁRIA · ${d.form ?? base}` : base;
  }
  return RARITY_NAME[d.rarity] ? `${RARITY_NAME[d.rarity]} · ${CAP_LABEL[d.type]}` : CAP_LABEL[d.type];
}

// Índice da rampa de cor da faixa (o arco-íris troca de rampa com o tempo).
const rampIndex = (band, time) => POWER.ramps.indexOf(rampOf(band, time));
const PLANET_COLORS = [
  ["#7cb4ff", "#3d6bff", "#1a2550"],
  ["#e8c9a4", "#c09a7a", "#5a4032"],
  ["#d6bcff", "#a46bff", "#2f1b66"],
  ["#b6ffc4", "#4ee36a", "#1d8f45"],
  ["#ffb3dc", "#ff3d55", "#9c1a33"],
  ["#ffe0a8", "#ffd23f", "#b4501a"],
];

const makeCanvas = (w, h) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

export function createRenderer(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext("2d");
  const sprites = buildSprites(makeCanvas);
  let H = 400;
  let t = 0;
  let sectorShown = 0;
  let bg = null;
  let bgOld = null;
  let bgFade = 0;
  let planet = null;
  let nebulas = [];
  let stars = [];
  const fx = { parts: [], booms: [], texts: [], rings: [], ghosts: [], trail: [], later: [], flash: 0, shake: 0, hurt: 0 };

  function resize(height) {
    H = height;
    canvas.width = W * RES;
    canvas.height = H * RES;
    ctx.imageSmoothingEnabled = false;
    stars = [];
    const layers = [
      { n: 46, speed: 8, size: 1, alpha: 0.45 },
      { n: 24, speed: 20, size: 1, alpha: 0.75 },
      { n: 10, speed: 46, size: 1, alpha: 1 },
    ];
    for (const [li, L] of layers.entries()) {
      for (let i = 0; i < L.n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H, layer: li, ...L, tw: Math.random() * 6 });
    }
    if (sectorShown) setSector(sectorShown, true);
  }

  // ---------- fundo ----------

  function gradient(top, bottom) {
    const c = makeCanvas(W, H);
    const cx = c.getContext("2d");
    const img = cx.createImageData(W, H);
    const a = hexRgb(top);
    const b = hexRgb(bottom);
    const steps = 7;
    for (let y = 0; y < H; y++) {
      const v = (y / (H - 1)) * (steps - 1);
      for (let x = 0; x < W; x++) {
        const d = BAYER[y % 4][x % 4] / 16 - 0.5;
        const idx = Math.max(0, Math.min(steps - 1, Math.round(v + d)));
        const k = idx / (steps - 1);
        const o = (y * W + x) * 4;
        img.data[o] = a[0] + (b[0] - a[0]) * k;
        img.data[o + 1] = a[1] + (b[1] - a[1]) * k;
        img.data[o + 2] = a[2] + (b[2] - a[2]) * k;
        img.data[o + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    return c;
  }

  function nebula([outer, inner], w, h) {
    const c = makeCanvas(w, h);
    const cx = c.getContext("2d");
    const blobs = Array.from({ length: 7 }, () => ({
      x: w * (0.2 + Math.random() * 0.6),
      y: h * (0.2 + Math.random() * 0.6),
      r: Math.min(w, h) * (0.18 + Math.random() * 0.25),
    }));
    const rgb = hexRgb(outer);
    const light = hexRgb(inner);
    const img = cx.createImageData(w, h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let d = 0;
        for (const b of blobs) {
          const q = ((x - b.x) ** 2 + (y - b.y) ** 2) / (b.r * b.r);
          d += Math.exp(-q * 1.6);
        }
        const th = BAYER[y % 4][x % 4] / 16;
        const o = (y * w + x) * 4;
        if (d > 0.55 + th * 0.5) {
          const dense = d > 1.15 + th * 0.4;
          const col = dense ? light : rgb;
          img.data[o] = col[0];
          img.data[o + 1] = col[1];
          img.data[o + 2] = col[2];
          img.data[o + 3] = dense ? 90 : 48;
        }
      }
    }
    cx.putImageData(img, 0, 0);
    return c;
  }

  function planetSprite(colors, r, ringed) {
    const size = r * 2 + (ringed ? r : 0) + 4;
    const c = makeCanvas(size, size);
    const cx = c.getContext("2d");
    const img = cx.createImageData(size, size);
    const pal = colors.map(hexRgb);
    const cxp = size / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - cxp) / r;
        const dy = (y + 0.5 - cxp) / r;
        if (dx * dx + dy * dy > 1) continue;
        const lit = 0.5 - (dx * 0.6 + dy * 0.6) + BAYER[y % 4][x % 4] / 32 + Math.sin((y / r) * 9) * 0.05;
        const col = lit > 0.85 ? pal[0] : lit > 0.25 ? pal[1] : pal[2];
        const o = (y * size + x) * 4;
        img.data[o] = col[0];
        img.data[o + 1] = col[1];
        img.data[o + 2] = col[2];
        img.data[o + 3] = 255;
      }
    }
    cx.putImageData(img, 0, 0);
    if (ringed) {
      cx.strokeStyle = colors[0];
      cx.globalAlpha = 0.7;
      cx.beginPath();
      cx.ellipse(cxp, cxp, r * 1.45, r * 0.32, -0.35, 0, Math.PI * 2);
      cx.stroke();
    }
    return c;
  }

  function setSector(n, instant = false) {
    const info = sectorInfo(n);
    if (bg && !instant) {
      bgOld = bg;
      bgFade = 1;
    }
    bg = gradient(info.bg[0], info.bg[1]);
    nebulas = [0, 1].map((i) => ({ c: nebula(info.nebula, 150, 110), x: Math.random() * (W - 150), y: -110 - i * (H * 0.7) - Math.random() * 60 }));
    const colors = PLANET_COLORS[(n - 1) % PLANET_COLORS.length];
    const r = 14 + ((n * 7) % 16);
    const side = n % 2 ? 6 + ((n * 17) % 30) : W - r * 2 - 10 - ((n * 13) % 30);
    planet = { c: planetSprite(colors, r, n % 2 === 0), x: side, y: instant ? H * 0.25 : -r * 3 };
    sectorShown = n;
  }

  function drawBackground(g, dt, scroll) {
    if (!bg || sectorShown !== g.sector) setSector(g.sector, !bg);
    ctx.drawImage(bg, 0, 0);
    if (bgOld && bgFade > 0) {
      ctx.globalAlpha = bgFade;
      ctx.drawImage(bgOld, 0, 0);
      ctx.globalAlpha = 1;
      bgFade -= dt / 1.6;
    }
    if (planet) {
      planet.y += 4 * scroll * dt;
      ctx.drawImage(planet.c, Math.round(planet.x), Math.round(planet.y));
    }
    for (const nb of nebulas) {
      nb.y += 11 * scroll * dt;
      if (nb.y > H) {
        nb.y = -nb.c.height - Math.random() * H;
        nb.x = Math.random() * (W - nb.c.width + 40) - 20;
      }
      ctx.drawImage(nb.c, Math.round(nb.x), Math.round(nb.y));
    }
    const color = sectorInfo(g.sector).star;
    for (const s of stars) {
      s.y += s.speed * scroll * dt;
      if (s.y > H) {
        s.y -= H + 4;
        s.x = Math.random() * W;
      }
      const tw = s.layer === 0 ? 0.6 + 0.4 * Math.sin(t * 3 + s.tw) : 1;
      ctx.globalAlpha = s.alpha * tw;
      ctx.fillStyle = s.layer === 2 ? "#ffffff" : color;
      const len = Math.max(1, Math.round(s.speed * scroll * 0.035));
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, s.layer === 0 ? 1 : len);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- sprites ----------

  // glow: em vez de pintar tudo de branco, sobrepõe o branco translúcido
  // (usado nos chefes e inimigos grandes).
  function spr(name, frame, x, y, { flash = false, flip = false, alpha = 1, glow = 0 } = {}) {
    const s = sprites[name] ?? sprites.make(name);
    const set = flash ? s.flash : flip && s.flipped ? s.flipped : s.frames;
    const i = ((frame % set.length) + set.length) % set.length;
    const left = Math.round(x - s.w / 2);
    const top = Math.round(y - s.h / 2);
    if (alpha !== 1) ctx.globalAlpha = alpha;
    // alta definição: a grade dobrada ocupa o mesmo espaço no mundo
    if (s.hd) ctx.drawImage(set[i], left, top, s.w, s.h);
    else ctx.drawImage(set[i], left, top);
    if (glow > 0) {
      ctx.globalAlpha = glow * alpha;
      if (s.hd) ctx.drawImage(s.flash[i % s.flash.length], left, top, s.w, s.h);
      else ctx.drawImage(s.flash[i % s.flash.length], left, top);
    }
    if (alpha !== 1 || glow > 0) ctx.globalAlpha = 1;
  }

  const anim = (fps, offset = 0) => Math.floor(t * fps + offset);

  function drawPlayer(g) {
    const p = g.player;
    if (g.status !== "playing") return;
    const def = SHIPS[p.ship];
    const blink = p.inv > 0 && Math.floor(t * 16) % 2 === 0;
    for (let i = 0; i < Math.min(p.drones, p.dronePos.length); i++) {
      const d = p.dronePos[i];
      spr("chama", anim(14, i), d.x, d.y + 5);
      spr("drone", 0, d.x, d.y);
    }
    if (g.turboT > 0 && !reducedMotion) {
      for (const [i, tr] of fx.trail.entries()) spr(def.sprite, 0, tr.x, tr.y, { flash: true, alpha: 0.08 + i * 0.04 });
    }
    if (!blink) {
      const s = sprites[def.sprite];
      const left = Math.round(p.x - s.w / 2);
      const top = Math.round(p.y - s.h / 2);
      for (const [ex, ey] of def.engines) {
        const f = sprites.chama.frames[anim(18) % 3];
        ctx.drawImage(f, left + ex, top + ey);
      }
      const banking = Math.abs(p.vx) > 50;
      spr(banking ? `${def.sprite}_bank` : def.sprite, 0, p.x, p.y, { flip: banking && p.vx > 0 });
    }
    if (p.shield) spr("escudo", anim(10), p.x, p.y, { alpha: 0.75 + 0.25 * Math.sin(t * 9) });
  }

  function drawEnemies(g) {
    // paleta da volta (1 carmesim, 2 dourado, 3 sombra) e, depois da 3ª, mais brilho
    const lap = lapOf(g.sector);
    const skin = lapSkin(lap);
    const lapGlow = lap > LAPS.glowAfter ? LAPS.glow : 0;
    for (const e of g.enemies) {
      let frame = anim(e.type === "mina" && near(e, g.player, 46) ? 10 : 4, e.x0 * 0.13);
      if (e.rot !== undefined) frame = Math.floor(((e.rot % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 2));
      const hit = e.flash > 0;
      const name = `${e.def.sprite}${skin ? `@${skin}` : ""}${e.elite ? "@elite" : ""}`;
      spr(name, frame, e.x, e.y, e.w >= 20 ? { glow: hit ? 0.45 : lapGlow } : { flash: hit, glow: lapGlow });
      if (e.type === "portador" && Math.random() < 0.25) {
        spark(e.x + (Math.random() - 0.5) * e.w, e.y + (Math.random() - 0.5) * e.h, "#fff4b0", 0.35, 6);
      }
    }
  }

  function drawBoss(g) {
    const b = g.boss;
    if (!b) return;
    if (b.id === "olho") {
      spr("olho", b.lid, b.x, b.y, { glow: b.flash > 0 ? 0.4 : 0 });
      if (b.lid !== 2) {
        const p = g.player;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(5, d / 20);
        const iy = b.lid === 1 ? 3 : 0;
        spr("iris", 0, b.x + (dx / d) * k, b.y + 0.5 + (dy / d) * k * 0.7 + iy);
      }
    } else {
      spr(b.def.sprite, anim(6), b.x, b.y, { glow: b.flash > 0 ? 0.4 : 0 });
    }
  }

  function drawShots(g) {
    for (const s of g.shots) spr(SHOTS[s.kind].sprite, anim(10, s.t * 3), s.x, s.y);
  }

  function drawLasers(g) {
    for (const l of g.lasers) {
      const len = 700;
      if (l.t < l.warn) {
        if (Math.floor(l.t * 14) % 2) continue;
        ctx.strokeStyle = "#ff5fb4";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(l.x + 0.5, l.y + 0.5);
        ctx.lineTo(l.x + Math.cos(l.from) * len, l.y + Math.sin(l.from) * len);
        ctx.stroke();
        continue;
      }
      ctx.save();
      ctx.translate(Math.round(l.x), Math.round(l.y));
      ctx.rotate(l.angle - Math.PI / 2);
      const wob = Math.floor(t * 30) % 2;
      const layers = [
        [l.width + 2 + wob, "#a01f72", 0.55],
        [l.width, "#ff5fb4", 1],
        [l.width - 3, "#ffb3dc", 1],
        [1, "#ffffff", 1],
      ];
      for (const [w, c, a] of layers) {
        ctx.globalAlpha = a;
        ctx.fillStyle = c;
        ctx.fillRect(-Math.floor(w / 2), 0, w, len);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // Feixe vertical de top a bottom: borda escura, corpo médio e miolo claro.
  function beam(x, top, bottom, width, [light, mid, dark]) {
    const h = bottom - top;
    if (h <= 0) return;
    ctx.fillStyle = dark;
    ctx.fillRect(x - width / 2, top, width, h);
    ctx.fillStyle = mid;
    ctx.fillRect(x - width / 2 + 0.5, top, width - 1, h);
    ctx.fillStyle = light;
    const core = Math.max(0.5, width / 4);
    ctx.fillRect(x - core / 2, top, core, h);
  }

  function drawBeams(g) {
    const p = g.player;
    if (g.beam) {
      const ramp = rampOf(g.beam.band, g.t);
      beam(Math.round(g.beam.x), -4, p.y - 7, g.beam.width, ramp);
      ctx.fillStyle = ramp[0];
      ctx.fillRect(Math.round(g.beam.x) - 1.5, p.y - 8.5, 3, 2); // clarão no cano
    }
    if (g.droneBeams.length) {
      const ramp = rampOf(bandOf(p.drones), g.t);
      for (const b of g.droneBeams) beam(Math.round(b.x), b.y - b.len, b.y, 2, ramp);
    }
  }

  function drawPlayerShots(g) {
    drawBeams(g);
    for (const b of g.bullets) {
      const i = rampIndex(b.band ?? 0, g.t);
      if (b.shard) {
        const [light, mid] = POWER.ramps[i];
        ctx.fillStyle = mid;
        ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 2, 2);
        ctx.fillStyle = light;
        ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 1, 1);
        continue;
      }
      spr(`${b.drone ? "tiro_drone" : b.big ? "tiro_max" : "tiro"}@${i}`, 0, b.x, b.y);
    }
    for (const r of g.rockets) {
      const cx = Math.round(r.x);
      const cy = Math.round(r.y);
      const bx = Math.cos(r.angle);
      const by = Math.sin(r.angle);
      ctx.fillStyle = "#ff3d55";
      ctx.fillRect(Math.round(cx - bx * 2), Math.round(cy - by * 2), 1, 1);
      ctx.fillStyle = "#b9c3dc";
      ctx.fillRect(Math.round(cx - bx), Math.round(cy - by), 1, 1);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(cx, cy, 1, 1);
      if (Math.random() < 0.7) smoke(r.x - bx * 3, r.y - by * 3);
    }
  }

  function drawItems(g) {
    for (const it of g.items) {
      if (it.kind !== "cap") {
        spr("cristal", anim(8, it.t * 4), it.x, it.y);
        continue;
      }
      // rara ou melhor: anel na cor da raridade (lendária com dois)
      const color = RARITY[it.rarity]?.color;
      if (color) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        const rings = it.rarity === "lendaria" ? [8, 10.5] : [8];
        for (const r of rings) {
          ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 6 + it.t * 3 + r);
          ctx.beginPath();
          ctx.arc(Math.round(it.x), Math.round(it.y), r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
      spr(`cap_${it.type}`, anim(4, it.t), it.x, it.y);
    }
  }

  // ---------- efeitos ----------

  function near(a, b, r) {
    return Math.abs(a.x - b.x) < r && Math.abs(a.y - b.y) < r;
  }

  function particle(x, y, vx, vy, life, color, size = 1, drag = 3) {
    if (fx.parts.length > 700) return;
    fx.parts.push({ x, y, vx, vy, life, max: life, color, size, drag });
  }

  function spark(x, y, color, life = 0.2, speed = 50) {
    const a = Math.random() * Math.PI * 2;
    particle(x, y, Math.cos(a) * speed * Math.random(), Math.sin(a) * speed * Math.random(), life, color);
  }

  function smoke(x, y) {
    particle(x, y, (Math.random() - 0.5) * 6, 10 + Math.random() * 10, 0.35 + Math.random() * 0.25, "#7a849f", 1, 2);
  }

  function burst(x, y, colors, n, speed, life = 0.6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (0.5 + Math.random() * 0.5), colors[i % colors.length], Math.random() < 0.3 ? 2 : 1);
    }
  }

  function boom(x, y, delay = 0, frameDur = 0.055) {
    fx.booms.push({ x, y, t: -delay, frameDur });
  }

  function ring(x, y, color, max, dur = 0.4) {
    fx.rings.push({ x, y, color, max, t: 0, dur });
  }

  function text(str, x, y, color = "#f4f7ff", dur = 0.8, scale = 1) {
    fx.texts.push({ str, x, y, color, t: 0, dur, scale });
  }

  function later(delay, fn) {
    fx.later.push({ t: delay, fn });
  }

  function shake(v) {
    if (!reducedMotion) fx.shake = Math.max(fx.shake, v);
  }

  function flash(v) {
    if (!reducedMotion) fx.flash = Math.max(fx.flash, v);
  }

  function event(type, d, g) {
    switch (type) {
      case "hit":
        for (let i = 0; i < 2; i++) spark(d.x, d.y + 3, i ? "#fff4b0" : "#ffd23f", 0.15, 70);
        break;
      case "kill": {
        const colors = DEBRIS[d.type] ?? DEBRIS.nave;
        burst(d.x, d.y, colors, Math.min(22, 4 + d.size), 40 + d.size * 4, 0.55);
        if (d.size >= 9) boom(d.x, d.y);
        if (d.size >= 20) {
          boom(d.x - 6, d.y + 4, 0.08);
          boom(d.x + 7, d.y - 3, 0.14);
          shake(3);
        }
        if (d.score >= 60 || d.mult >= 3) text(`+${d.score}`, d.x, d.y - 8, d.mult >= 4 ? "#ffd23f" : "#f4f7ff", 0.7);
        break;
      }
      case "explode":
        boom(d.x, d.y, 0, 0.04);
        burst(d.x, d.y, ["#ffd23f", "#ff8a2a"], 5, 50, 0.3);
        break;
      case "cap_spawn": {
        const rare = RARITY[d.rarity]?.color;
        ring(d.x, d.y, rare ?? CAP_COLORS[d.type], rare ? 22 : 14, rare ? 0.5 : 0.35);
        break;
      }
      case "cap": {
        const color = RARITY[d.rarity]?.color ?? CAP_COLORS[d.type];
        ring(d.x, d.y, color, 24, 0.4);
        burst(d.x, d.y, [color, CAP_COLORS[d.type], "#ffffff"], d.rarity && d.rarity !== "comum" ? 20 : 12, 70, 0.5);
        text(capLabel(d), g.player.x, g.player.y - 16, color, 1.1);
        break;
      }
      case "form": {
        // forma nova: anel na cor da faixa e o nome grande no centro
        const color = rampOf(d.band, g.t)[1];
        ring(g.player.x, g.player.y, color, 34, 0.6);
        ring(g.player.x, g.player.y, "#ffffff", 20, 0.35);
        text(d.name, W / 2, H * 0.36, color, 1.2, 3);
        break;
      }
      case "cristal":
        spark(d.x, d.y, "#c4fcff", 0.25, 30);
        spark(d.x, d.y, "#48e4f0", 0.25, 30);
        break;
      case "graze":
        spark(d.x, d.y, "#ffffff", 0.2, 40);
        break;
      case "hurt":
        burst(d.x, d.y, DEBRIS.nave, 10, 60, 0.5);
        fx.hurt = 1;
        shake(5);
        break;
      case "shield_break":
        ring(d.x, d.y, "#48e4f0", 26, 0.35);
        burst(d.x, d.y, ["#48e4f0", "#c4fcff"], 14, 80, 0.45);
        shake(3);
        break;
      case "shield_up":
        ring(g.player.x, g.player.y, "#48e4f0", 14, 0.3);
        break;
      case "turbo":
        if (d.on) {
          ring(g.player.x, g.player.y, "#ffd23f", 40, 0.5);
          text("TURBO", g.player.x, g.player.y - 18, "#ffd23f", 1.1, 2);
        }
        break;
      case "combo":
        if (d.mult >= 2) text(`×${d.mult}`, g.player.x + 12, g.player.y - 10, "#ffd23f", 0.7);
        break;
      case "clear_shots":
        for (const [x, y] of d.points) spark(x, y, "#d6bcff", 0.4, 20);
        break;
      case "pulse":
        ring(d.x, d.y, "#d6bcff", 300, 0.6);
        ring(d.x, d.y, "#ffffff", 200, 0.45);
        flash(0.3);
        shake(6);
        break;
      case "boss_phase":
        if (g.boss) {
          ring(g.boss.x, g.boss.y, "#ffffff", 50, 0.4);
          boom(g.boss.x - 10, g.boss.y);
          boom(g.boss.x + 12, g.boss.y + 6, 0.1);
        }
        shake(5);
        break;
      case "boss_kill": {
        fx.ghosts.push({ name: d.sprite, x: d.x, y: d.y, t: 0, dur: 1.3 });
        for (let i = 0; i < 14; i++) boom(d.x + (Math.random() - 0.5) * d.w * 0.8, d.y + (Math.random() - 0.5) * d.h * 0.8, i * 0.09);
        later(1.25, () => {
          burst(d.x, d.y, DEBRIS.chefe, 60, 140, 1);
          ring(d.x, d.y, "#fff4b0", 120, 0.6);
          flash(0.35);
          shake(10);
        });
        shake(6);
        text(`+${d.score}`, d.x, d.y - 4, "#ffd23f", 1.6, 2);
        break;
      }
      case "deflect":
        spark(d.x, d.y, "#b9c3dc", 0.12, 40);
        break;
      case "dead":
        burst(d.x, d.y, DEBRIS.nave, 40, 110, 1);
        boom(d.x, d.y);
        boom(d.x - 6, d.y - 5, 0.12);
        boom(d.x + 6, d.y + 4, 0.22);
        ring(d.x, d.y, "#ffffff", 40, 0.45);
        flash(0.25);
        shake(8);
        break;
      default:
    }
  }

  function updateFx(dt) {
    for (const l of fx.later) {
      l.t -= dt;
      if (l.t <= 0) l.fn();
    }
    fx.later = fx.later.filter((l) => l.t > 0);
    for (const p of fx.parts) {
      p.life -= dt;
      p.vx *= 1 - Math.min(1, p.drag * dt);
      p.vy *= 1 - Math.min(1, p.drag * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    fx.parts = fx.parts.filter((p) => p.life > 0);
    for (const b of fx.booms) b.t += dt;
    fx.booms = fx.booms.filter((b) => b.t < b.frameDur * 5);
    for (const r of fx.rings) r.t += dt;
    fx.rings = fx.rings.filter((r) => r.t < r.dur);
    for (const x of fx.texts) x.t += dt;
    fx.texts = fx.texts.filter((x) => x.t < x.dur);
    for (const gh of fx.ghosts) gh.t += dt;
    fx.ghosts = fx.ghosts.filter((gh) => gh.t < gh.dur);
    fx.flash = Math.max(0, fx.flash - dt * 1.4);
    fx.shake = Math.max(0, fx.shake - dt * 22);
    fx.hurt = Math.max(0, fx.hurt - dt * 2);
  }

  function drawFx() {
    // chefe derrotado: esquenta até ficar branco, sem piscar
    for (const gh of fx.ghosts) spr(gh.name, 0, gh.x + (Math.random() - 0.5) * 3, gh.y, { glow: 0.15 + 0.75 * (gh.t / gh.dur) });
    for (const b of fx.booms) {
      if (b.t < 0) continue;
      spr("boom", Math.floor(b.t / b.frameDur), b.x, b.y);
    }
    for (const p of fx.parts) {
      ctx.globalAlpha = Math.min(1, (p.life / p.max) * 1.6);
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    ctx.globalAlpha = 1;
    for (const r of fx.rings) {
      const u = r.t / r.dur;
      ctx.globalAlpha = 1 - u;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(r.x) + 0.5, Math.round(r.y) + 0.5, 2 + r.max * easeOut(u), 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    for (const x of fx.texts) {
      const u = x.t / x.dur;
      const rise = reducedMotion ? 0 : 10 * easeOut(Math.min(1, u * 2));
      ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
      const half = textWidth(x.str, x.scale) / 2;
      const cx = Math.max(half + 2, Math.min(W - half - 2, x.x));
      drawText(ctx, x.str, cx, x.y - rise, x.color, { scale: x.scale });
    }
    ctx.globalAlpha = 1;
  }

  // ---------- quadro ----------

  function draw(g, dt) {
    if (dt > 0) t += dt;
    if (dt > 0) updateFx(dt);
    const p = g.player;
    if (g.turboT > 0 && dt > 0) {
      fx.trail.push({ x: p.x, y: p.y });
      if (fx.trail.length > 4) fx.trail.shift();
    } else if (fx.trail.length) fx.trail.length = 0;

    const scroll = g.status !== "playing" ? 0.4 : g.phase === "after" ? 4 : g.turboT > 0 ? 2.6 : 1;
    const sx = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake) : 0;
    const sy = fx.shake ? Math.round((Math.random() - 0.5) * fx.shake) : 0;
    ctx.setTransform(RES, 0, 0, RES, sx * RES, sy * RES);
    drawBackground(g, dt, scroll);
    drawItems(g);
    drawEnemies(g);
    drawBoss(g);
    drawPlayerShots(g);
    drawPlayer(g);
    drawShots(g);
    drawLasers(g);
    drawFx();
    ctx.setTransform(RES, 0, 0, RES, 0, 0);

    // casco em 1: borda vermelha pulsando; dano: borda forte
    const low = g.status === "playing" && p.hp === 1 && g.mode === "run" ? 0.25 + 0.15 * Math.sin(t * 6) : 0;
    const edge = Math.max(low, fx.hurt * 0.7);
    if (edge > 0.01) {
      ctx.fillStyle = `rgba(255,61,85,${edge})`;
      ctx.fillRect(0, 0, W, 3);
      ctx.fillRect(0, H - 3, W, 3);
      ctx.fillRect(0, 0, 3, H);
      ctx.fillRect(W - 3, 0, 3, H);
    }
    if (fx.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.25, fx.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  return { resize, draw, event, sprites, setSector };
}

const easeOut = (u) => 1 - (1 - u) * (1 - u);

function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export { CAP_COLORS, CAP_LABEL, CAP_NAMES };
