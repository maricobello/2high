// Desenho no canvas. O mundo usa y para cima (0 = topo da base); a câmera
// segue o topo da torre e, ao concluir a fase, afasta para mostrar a torre inteira.
import { BLOCK_H } from "./game.js";

const VIEW_W = 420;
const VIEW_H = 720;
const FONT = "Unbounded, system-ui, sans-serif";

export function createRenderer(canvas, { reducedMotion = false } = {}) {
  const ctx = canvas.getContext("2d");
  let vw = 0;
  let vh = 0;
  const cam = { y: 0, scale: 1, anchor: null };
  const bg = { top: [23, 52, 87], bottom: [10, 22, 38] };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    vw = canvas.clientWidth;
    vh = canvas.clientHeight;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  // focus: faixa livre da tela em px ({ top, bottom }) quando há cartão ou
  // botões por cima; a torre é enquadrada dentro dela.
  function draw(g, dt, { record = 0, focus = null } = {}) {
    if (!vw) resize();
    const base = Math.min(vw / VIEW_W, vh / VIEW_H);
    const k = 1 - Math.exp(-dt * 6);
    const towerTop = g.height * BLOCK_H;

    // câmera: segue o topo; na vitória, afasta até caber a torre inteira
    const area = focus ?? { top: 110, bottom: vh - 24 };
    const areaH = Math.max(80, area.bottom - area.top);
    let targetScale = base;
    let targetY = towerTop;
    let targetAnchor = vh * 0.6;
    if (g.status === "won") {
      targetScale = Math.min(base, (areaH * 0.85) / (towerTop + BLOCK_H * 2));
      targetY = towerTop / 2;
      targetAnchor = (area.top + area.bottom) / 2;
    } else if (focus) {
      targetScale = Math.min(base, areaH / (BLOCK_H * 5));
      targetAnchor = area.top + areaH * 0.62;
    }
    if (cam.anchor === null) {
      cam.anchor = targetAnchor;
      cam.scale = targetScale;
    }
    cam.scale += (targetScale - cam.scale) * k;
    cam.y += (targetY - cam.y) * k;
    cam.anchor += (targetAnchor - cam.anchor) * k;

    const colors = paletteFor(g);
    mixInto(bg.top, colors.bg[0], k * 0.5);
    mixInto(bg.bottom, colors.bg[1], k * 0.5);

    const s = cam.scale;
    const shake = reducedMotion ? 0 : g.shake;
    const ox = vw / 2 + (shake ? (Math.random() - 0.5) * shake : 0);
    const oy = cam.anchor + (shake ? (Math.random() - 0.5) * shake : 0);
    const sx = (x) => ox + x * s;
    const sy = (y) => oy - (y - cam.y) * s;

    // fundo
    const grad = ctx.createLinearGradient(0, 0, 0, vh);
    grad.addColorStop(0, rgb(bg.top));
    grad.addColorStop(1, rgb(bg.bottom));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, vw, vh);

    drawFloorScale(sy, s, [g.target, record]);
    if (g.target) drawGoalLine(sy, g.target, "META", g.target - g.height <= 3);
    if (record > 0) drawGoalLine(sy, record, "RECORDE", record - g.height <= 3);

    // base: um pilar que desce até o fim da tela
    const b0 = g.blocks[0];
    ctx.fillStyle = blockColor(colors, 0, 0.82);
    roundRect(sx(b0.x - b0.w / 2 + g.swayX), sy(0), b0.w * s, vh * 2, 3 * s);
    ctx.fill();

    // torre (só o que aparece na tela)
    const first = Math.max(1, Math.floor((cam.y - (vh - oy) / s) / BLOCK_H));
    const last = Math.min(g.blocks.length - 1, Math.ceil((cam.y + oy / s) / BLOCK_H) + 1);
    for (let i = first; i <= last; i++) {
      const b = g.blocks[i];
      const x = sx(b.x - b.w / 2 + g.swayX);
      const y = sy(i * BLOCK_H);
      drawBlock(x, y, b.w * s, BLOCK_H * s, colors, i, 1);
      if (g.status === "won") {
        const lit = 1 - Math.abs(g.endT * 28 - i) / 5;
        if (lit > 0) {
          ctx.fillStyle = `rgba(255,255,255,${0.55 * lit})`;
          roundRect(x, y, b.w * s, BLOCK_H * s, 3 * s);
          ctx.fill();
        }
      }
    }

    // fio de prumo: marca o centro da torre
    const topBlock = g.blocks[g.blocks.length - 1];
    if (g.moving) {
      const px = sx(topBlock.x + g.swayX);
      const py = sy(towerTop + BLOCK_H * 2.4);
      const from = sy(towerTop + BLOCK_H * 7);
      const line = ctx.createLinearGradient(0, from, 0, py);
      line.addColorStop(0, "rgba(255,255,255,0)");
      line.addColorStop(1, "rgba(255,255,255,0.2)");
      ctx.strokeStyle = line;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(px, from);
      ctx.lineTo(px, sy(towerTop));
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.beginPath();
      ctx.moveTo(px, py - 7 * s);
      ctx.lineTo(px + 4 * s, py);
      ctx.lineTo(px, py + 7 * s);
      ctx.lineTo(px - 4 * s, py);
      ctx.closePath();
      ctx.fill();

      const m = g.moving;
      drawBlock(sx(m.x - m.w / 2), sy(towerTop + BLOCK_H), m.w * s, BLOCK_H * s, colors, g.height + 1, 1.12);
    }

    // pedaços cortados caindo
    for (const d of g.debris) {
      ctx.save();
      ctx.translate(sx(d.x), sy(d.y + BLOCK_H / 2));
      ctx.rotate(d.rot);
      ctx.globalAlpha = 0.9;
      drawBlock((-d.w / 2) * s, (-BLOCK_H / 2) * s, d.w * s, BLOCK_H * s, colors, d.i, 0.9);
      ctx.restore();
    }

    // efeitos: anel do perfeito e textos
    for (const e of g.effects) {
      const p = e.t / e.dur;
      if (e.type === "ring") {
        const grow = (reducedMotion ? 6 : 26) * p;
        ctx.strokeStyle = `rgba(255,255,255,${0.9 * (1 - p)})`;
        ctx.lineWidth = 2;
        roundRect(
          sx(e.x - e.w / 2 - grow + g.swayX),
          sy(e.y + BLOCK_H + grow),
          (e.w + grow * 2) * s,
          (BLOCK_H + grow * 2) * s,
          6 * s,
        );
        ctx.stroke();
      } else {
        const rise = reducedMotion ? 0 : 40 * p;
        ctx.globalAlpha = Math.min(1, (1 - p) * 2.2);
        ctx.fillStyle = e.kind === "near" ? "#ffd166" : "#ffffff";
        ctx.font = `800 ${Math.round(15 * Math.max(s, 0.9))}px ${FONT}`;
        ctx.textAlign = "center";
        ctx.fillText(e.text.toUpperCase(), sx(e.x + g.swayX), sy(e.y + BLOCK_H * 2.4 + rise));
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawBlock(x, y, w, h, colors, i, light) {
    const r = Math.min(3 * cam.scale, w / 2);
    ctx.fillStyle = blockColor(colors, i, light);
    roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.fillRect(x + r, y, Math.max(0, w - r * 2), Math.max(1, h * 0.12));
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x, y + h - Math.max(1, h * 0.08), w, Math.max(1, h * 0.08));
  }

  // Régua de andares à esquerda, como numa planta de fachada.
  function drawFloorScale(sy, s, skip) {
    ctx.font = `500 10px ${FONT}`;
    ctx.textAlign = "left";
    const step = 5;
    const minFloor = Math.max(step, Math.floor((cam.y - vh / s) / BLOCK_H / step) * step);
    const maxFloor = Math.ceil((cam.y + vh / s) / BLOCK_H / step) * step;
    for (let f = minFloor; f <= maxFloor; f += step) {
      const y = sy(f * BLOCK_H);
      // fora da tela, sob a barra do topo ou sobre uma linha de meta: não desenha
      if (y < 90 || y > vh + 10 || skip.includes(f)) continue;
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fillRect(14, y, 10, 1);
      ctx.fillStyle = "rgba(255,255,255,0.32)";
      ctx.fillText(String(f), 28, y + 4);
    }
  }

  function drawGoalLine(sy, floor, label, close) {
    const y = sy(floor * BLOCK_H);
    if (y < -20 || y > vh + 20) return;
    ctx.strokeStyle = close ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.35)";
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(vw, y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = `800 10px ${FONT}`;
    ctx.textAlign = "right";
    ctx.fillStyle = close ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.5)";
    ctx.fillText(`${label} ${floor}`, vw - 14, y - 6);
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  return { resize, draw };
}

// Cores da fase atual; no Infinito o tom gira com a altura.
function paletteFor(g) {
  if (g.mode === "endless") {
    const hue = (196 + g.height * 5) % 360;
    return { hue, step: 5, bg: [hslToRgb(hue, 0.45, 0.2), hslToRgb(hue, 0.5, 0.07)] };
  }
  return { hue: g.phase.hue, step: 2.4, bg: g.phase.bg.map(hexToRgb) };
}

function blockColor(colors, i, light) {
  const hue = (colors.hue + i * colors.step) % 360;
  return `hsl(${hue.toFixed(1)} 62% ${Math.min(80, 55 * light).toFixed(1)}%)`;
}

function mixInto(cur, target, k) {
  for (let i = 0; i < 3; i++) cur[i] += (target[i] - cur[i]) * k;
}

function rgb(c) {
  return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function hslToRgb(h, s, l) {
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return 255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

