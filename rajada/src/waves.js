// Formações de inimigos. Cada onda devolve uma lista de entradas
// { at: segundos, type, params } que a partida vai soltando no tempo certo.

const between = (rng, a, b) => rng.range(a, b);

export function buildWave(id, rng, W, H) {
  const list = [];
  const add = (at, type, params) => list.push({ at, type, params });
  const margin = 26;
  switch (id) {
    case "fila": {
      const x = between(rng, margin, W - margin);
      for (let i = 0; i < 5; i++) add(i * 0.28, "zangao", { x, y: -8, vy: 62 });
      break;
    }
    case "v": {
      const cx = between(rng, 60, W - 60);
      for (let i = -3; i <= 3; i++) add(Math.abs(i) * 0.12, "zangao", { x: cx + i * 13, y: -8, vy: 52 });
      break;
    }
    case "serpente": {
      const x = between(rng, 70, W - 70);
      const phase = rng.chance(0.5) ? 0 : Math.PI;
      for (let i = 0; i < 6; i++) {
        add(i * 0.3, "zangao", { x, y: -8, vy: 58, move: "sine", amp: 46, freq: 2.2, phase: phase - i * 0.3 * 2.2 });
      }
      break;
    }
    case "dardos": {
      const n = rng.int(2, 3);
      for (let i = 0; i < n; i++) {
        add(i * 0.55, "dardo", {
          x: between(rng, margin, W - margin),
          y: -10,
          move: "dive",
          yStop: between(rng, 30, 70),
          diveSpeed: 165,
        });
      }
      break;
    }
    case "atiradores": {
      const left = between(rng, 40, W / 2 - 20);
      const right = W - left + between(rng, -14, 14);
      for (const [i, x] of [left, right].entries()) {
        add(i * 0.6, "atirador", {
          x,
          y: -10,
          move: "hover",
          yStop: between(rng, 46, 86),
          stayAt: 6.5,
          phase: i * Math.PI,
          fireT: 0.8 + i * 0.6,
        });
      }
      break;
    }
    case "pedras": {
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) {
        const big = rng.chance(0.55);
        add(i * 0.6, big ? "pedra_g" : "pedra_m", {
          x: between(rng, 20, W - 20),
          y: -12,
          vx: between(rng, -16, 16),
          vy: between(rng, 30, 48),
          spin: between(rng, 2, 5) * (rng.chance(0.5) ? 1 : -1),
        });
      }
      break;
    }
    case "couracado": {
      const x = between(rng, 70, W - 70);
      add(0, "couracado", { x, y: -14, vy: 22, move: "heavy", stayAt: 3.2, stayFor: 7, fireT: 1.2 });
      for (const dx of [-30, 30]) {
        add(0.5, "zangao", { x: x + dx, y: -8, vy: 50 });
        add(0.8, "zangao", { x: x + dx * 1.4, y: -8, vy: 50 });
      }
      break;
    }
    case "minas": {
      const n = 5;
      for (let i = 0; i < n; i++) {
        add(i * 0.35, "mina", { x: 24 + ((W - 48) * (i + rng.next() * 0.5)) / n, y: -8, vy: 26, vx: between(rng, -8, 8) });
      }
      break;
    }
    case "pinca": {
      for (let i = 0; i < 4; i++) {
        for (const side of [-1, 1]) {
          const x0 = side < 0 ? -10 : W + 10;
          add(i * 0.32, "zangao", {
            x: x0,
            y: 30,
            move: "curve",
            dur: 2.4,
            path: [
              [x0, 30],
              [W / 2 + side * -10, 40 + H * 0.15],
              [W / 2 - side * 70, H * 0.55],
            ],
          });
        }
      }
      break;
    }
    case "chuva": {
      for (let i = 0; i < 6; i++) {
        add(i * 0.3, "dardo", {
          x: 20 + ((W - 40) * i) / 5 + between(rng, -6, 6),
          y: -10,
          move: "dive",
          yStop: between(rng, 20, 40),
          diveSpeed: 190,
        });
      }
      break;
    }
    default:
      throw new Error(`onda desconhecida: ${id}`);
  }
  return list;
}

// Portador: cruza a tela levando uma cápsula. gentle: o da primeira partida,
// mais baixo, lento e frágil (é o primeiro upgrade e precisa sair fácil).
export function carrierEntry(rng, W, gentle = false) {
  const fromLeft = rng.chance(0.5);
  const y0 = gentle ? between(rng, 80, 110) : between(rng, 40, 80);
  const speed = gentle ? 24 : 40;
  return {
    at: 0,
    type: "portador",
    params: { x: fromLeft ? -10 : W + 10, y0, y: y0, vx: fromLeft ? speed : -speed, move: "cross", ...(gentle ? { hp: 4 } : {}) },
  };
}
