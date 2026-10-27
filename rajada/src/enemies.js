// Inimigos: criação, movimento e tiros. Cada um tem um "move" (como anda) e
// pode atirar. Os tiros saem por g.fire(), que aplica a velocidade do setor.
import { ENEMIES } from "./config.js";
import { sizeOf } from "./sprites.js";

const sizes = {};
for (const [type, def] of Object.entries(ENEMIES)) sizes[type] = sizeOf(def.sprite);

// params: posição e o que a onda definir (vx, vy, amp, freq, path...).
export function makeEnemy(type, params, hpScale = 1) {
  const def = ENEMIES[type];
  const hp = params.hp ?? def.hp * (type === "portador" ? 1 : hpScale);
  return {
    type,
    def,
    w: sizes[type].w,
    h: sizes[type].h,
    hp,
    maxHp: hp,
    t: 0,
    flash: 0,
    vx: 0,
    vy: 40,
    move: "down",
    fireT: 0,
    entered: false,
    ...params,
    x0: params.x,
  };
}

// Atualiza a posição; devolve false quando saiu da tela e pode sumir.
export function moveEnemy(e, dt, g) {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.flashCool > 0) e.flashCool -= dt;
  MOVES[e.move](e, dt, g);
  if (!e.entered && e.y > -e.h / 2 && e.x > -e.w / 2 && e.x < g.W + e.w / 2) e.entered = true;
  const out = e.y > g.H + e.h || e.y < -120 || e.x < -60 || e.x > g.W + 60;
  return !(e.entered && out) && e.t < 40;
}

const MOVES = {
  down(e, dt) {
    e.x += e.vx * dt;
    e.y += e.vy * dt;
  },
  sine(e, dt) {
    e.y += e.vy * dt;
    e.x = e.x0 + e.amp * Math.sin(e.t * e.freq + (e.phase ?? 0));
  },
  // Desce até yStop, pisca (aviso) e mergulha na direção da nave.
  dive(e, dt, g) {
    if (!e.state) e.state = "enter";
    if (e.state === "enter") {
      e.y += 90 * dt;
      if (e.y >= e.yStop) {
        e.state = "aim";
        e.aimT = 0.5;
      }
    } else if (e.state === "aim") {
      e.aimT -= dt;
      e.flash = Math.floor(e.aimT * 12) % 2 ? 0.05 : 0;
      if (e.aimT <= 0) {
        e.state = "dive";
        const dx = g.player.x - e.x;
        const dy = Math.max(40, g.player.y - e.y);
        const len = Math.hypot(dx, dy);
        const speed = e.diveSpeed * (1 + 0.05 * (g.sector - 1));
        e.vx = (dx / len) * speed;
        e.vy = (dy / len) * speed;
      }
    } else {
      e.x += e.vx * dt;
      e.y += e.vy * dt;
    }
  },
  // Desce, para no alto, anda de lado atirando e vai embora.
  hover(e, dt) {
    if (e.t < e.stayAt) {
      e.y += (e.yStop - e.y) * Math.min(1, dt * 2.2);
      e.x = e.x0 + Math.sin(e.t * 0.9 + (e.phase ?? 0)) * (e.amp ?? 26);
    } else {
      e.y += 70 * dt;
    }
  },
  // Curva de Bézier (entrada pelos lados) e depois segue reto.
  curve(e, dt) {
    const u = e.t / e.dur;
    if (u < 1) {
      const [p0, p1, p2] = e.path;
      const a = (1 - u) * (1 - u);
      const b = 2 * (1 - u) * u;
      const c = u * u;
      const nx = a * p0[0] + b * p1[0] + c * p2[0];
      const ny = a * p0[1] + b * p1[1] + c * p2[1];
      e.vx = (nx - e.x) / Math.max(dt, 1e-6);
      e.vy = (ny - e.y) / Math.max(dt, 1e-6);
      e.x = nx;
      e.y = ny;
    } else {
      e.x += e.vx * dt;
      e.y += Math.max(e.vy, 50) * dt;
    }
  },
  cross(e, dt) {
    e.x += e.vx * dt;
    e.y = e.y0 + Math.sin(e.t * 2) * 4;
  },
  // Couraçado: desce devagar, para um tempo e segue.
  heavy(e, dt) {
    if (e.t > e.stayAt && e.t < e.stayAt + e.stayFor) return;
    e.y += e.vy * dt;
  },
};

// Tiros de cada inimigo. g.fire(x, y, ângulo, velocidade, tipo).
export function enemyFire(e, dt, g) {
  const rate = g.fireRate();
  switch (e.type) {
    case "atirador": {
      if (e.t > e.stayAt || e.y < 10) return;
      e.fireT -= dt * rate;
      if (e.fireT <= 0) {
        e.fireT = 1.7;
        const a = g.aimAngle(e.x, e.y + 5);
        const n = g.sector >= 5 ? 5 : g.sector >= 3 ? 3 : 1;
        for (let i = 0; i < n; i++) g.fire(e.x, e.y + 5, a + (i - (n - 1) / 2) * 0.2, 78, "bala", { src: e.type });
      }
      break;
    }
    case "couracado": {
      if (e.y < 12) return;
      e.fireT -= dt * rate;
      if (e.fireT <= 0) {
        e.fireT = 2.2;
        const a = g.aimAngle(e.x, e.y + 10);
        for (let i = -2; i <= 2; i++) g.fire(e.x, e.y + 10, a + i * 0.2, 72, "bolha", { src: e.type });
      }
      break;
    }
    case "zangao": {
      // a partir do setor 2, alguns zangões soltam um tiro lento ao passar
      if (g.sector < 2 || e.shot || e.y < 50) return;
      e.shot = true;
      if (g.rng.chance(Math.min(0.4, 0.08 * g.sector))) g.fire(e.x, e.y + 4, g.aimAngle(e.x, e.y), 60, "bala", { src: e.type });
      break;
    }
    default:
  }
}

// Mina destruída solta um anel de tiros lentos (a partir do setor 2).
export function onEnemyDeath(e, g) {
  if (e.type === "mina" && g.sector >= 2) {
    const n = 8;
    for (let i = 0; i < n; i++) g.fire(e.x, e.y, (i / n) * Math.PI * 2 + e.t, 52, "bala", { src: e.type });
  }
}
