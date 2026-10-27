// Efeitos sintetizados com Web Audio (nenhum arquivo de áudio), música e
// vibração. O contexto de áudio só nasce no primeiro toque, como exigem
// iOS e Chrome. Sons repetidos (tiro, acerto) têm limite de frequência.
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { createMusic } from "./music.js";

// Escala pentatônica: qualquer sequência soa bem, então cristais seguidos viram melodia.
const PENTATONIC = [0, 2, 4, 7, 9];

export function noteFor(step, root) {
  const i = Math.min(step, 14);
  const semis = 12 * Math.floor(i / 5) + PENTATONIC[i % 5];
  return root * 2 ** (semis / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let sfx = null;
  let musicBus = null;
  let noise = null;
  let sfxOn = true;
  let musicOn = true;
  const last = {};
  const music = createMusic(
    () => ctx,
    () => musicBus,
  );

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      master.connect(comp).connect(ctx.destination);
      sfx = ctx.createGain();
      sfx.gain.value = sfxOn ? 1 : 0;
      sfx.connect(master);
      musicBus = ctx.createGain();
      musicBus.gain.value = musicOn ? 0.45 : 0;
      musicBus.connect(master);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.6, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      music.resync();
    }
    if (ctx.state === "suspended") ctx.resume().then(() => music.resync(), () => {});
  }

  const ready = () => ctx && sfxOn && ctx.state === "running";

  // Limite de repetição: no máximo um som do tipo `key` a cada `ms`.
  function allow(key, ms) {
    const now = performance.now();
    if (now - (last[key] ?? -1e9) < ms) return false;
    last[key] = now;
    return true;
  }

  function tone({ freq, to = freq, type = "square", gain = 0.1, attack = 0.004, dur = 0.12, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(sfx);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function hiss({ gain = 0.1, dur = 0.1, freq = 1200, to = freq, type = "lowpass", q = 0.8, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noise;
    filter.type = type;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(freq, t);
    if (to !== freq) filter.frequency.exponentialRampToValueAtTime(Math.max(20, to), t + dur);
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  const arp = (notes, step = 0.05, { delay = 0, ...opts } = {}) =>
    notes.forEach((f, i) => tone({ freq: f, dur: step * 1.6, gain: 0.07, ...opts, delay: delay + i * step }));

  return {
    unlock,
    music,
    suspend() {
      if (ctx && ctx.state === "running") ctx.suspend().catch(() => {});
    },
    setSfx(on) {
      sfxOn = on;
      if (sfx) sfx.gain.value = on ? 1 : 0;
    },
    setMusic(on) {
      musicOn = on;
      if (musicBus) musicBus.gain.value = on ? 0.45 : 0;
    },

    shot(level) {
      if (!ready() || !allow("shot", 95)) return;
      tone({ freq: level >= 4 ? 1100 : 1500, to: 600, gain: 0.022, dur: 0.035 });
    },
    rocket() {
      if (!ready() || !allow("rocket", 160)) return;
      hiss({ gain: 0.05, dur: 0.2, freq: 700, to: 2600, type: "bandpass", q: 2 });
    },
    hit() {
      if (!ready() || !allow("hit", 55)) return;
      hiss({ gain: 0.035, dur: 0.025, freq: 4200, type: "highpass" });
    },
    kill(size) {
      if (!ready() || !allow("kill", 35)) return;
      if (size >= 20) {
        hiss({ gain: 0.28, dur: 0.45, freq: 900, to: 90 });
        tone({ freq: 110, to: 38, type: "sine", gain: 0.3, dur: 0.35 });
      } else {
        hiss({ gain: 0.1, dur: 0.14, freq: 1800, to: 300 });
        tone({ freq: 320, to: 70, gain: 0.05, dur: 0.1 });
      }
    },
    explode() {
      if (!ready() || !allow("explode", 70)) return;
      hiss({ gain: 0.07, dur: 0.12, freq: 1600, to: 250 });
    },
    capSpawn() {
      if (!ready()) return;
      arp([880, 1320], 0.06, { gain: 0.045 });
    },
    cap(type) {
      if (!ready()) return;
      if (type === "H") arp([659, 880, 1047], 0.07, { type: "triangle", gain: 0.12 });
      else if (type === "E") arp([523, 784, 1047, 1568], 0.045, { type: "triangle", gain: 0.1 });
      else arp([523, 659, 784, 1047], 0.045);
    },
    cristal(streak) {
      if (!ready() || !allow("cristal", 30)) return;
      const f = noteFor(streak, 880);
      tone({ freq: f, type: "triangle", gain: 0.07, dur: 0.14 });
      tone({ freq: f * 2, type: "sine", gain: 0.025, dur: 0.1 });
    },
    graze() {
      if (!ready() || !allow("graze", 45)) return;
      tone({ freq: 3200, type: "sine", gain: 0.02, dur: 0.025 });
    },
    hurt() {
      if (!ready()) return;
      tone({ freq: 420, to: 70, type: "sawtooth", gain: 0.13, dur: 0.38 });
      hiss({ gain: 0.18, dur: 0.3, freq: 900, to: 120 });
    },
    shieldBreak() {
      if (!ready()) return;
      hiss({ gain: 0.12, dur: 0.22, freq: 5000, type: "highpass" });
      tone({ freq: 1400, to: 300, type: "triangle", gain: 0.1, dur: 0.25 });
    },
    shieldUp() {
      if (!ready()) return;
      tone({ freq: 600, to: 1300, type: "sine", gain: 0.07, dur: 0.18 });
    },
    turbo(on) {
      if (!ready()) return;
      if (on) {
        tone({ freq: 180, to: 1400, type: "sawtooth", gain: 0.07, dur: 0.45 });
        arp([784, 988, 1175, 1568], 0.06, { gain: 0.06, delay: 0.2 });
      } else {
        tone({ freq: 900, to: 200, type: "sawtooth", gain: 0.04, dur: 0.3 });
      }
    },
    pulse() {
      if (!ready()) return;
      hiss({ gain: 0.25, dur: 0.6, freq: 150, to: 4000 });
      tone({ freq: 70, to: 30, type: "sine", gain: 0.35, dur: 0.5 });
    },
    combo(mult) {
      if (!ready() || mult < 2) return;
      tone({ freq: noteFor(mult + 3, 523), type: "square", gain: 0.04, dur: 0.08 });
    },
    bossWarn() {
      if (!ready()) return;
      for (let i = 0; i < 4; i++) {
        tone({ freq: 660, gain: 0.05, dur: 0.24, delay: i * 0.5 });
        tone({ freq: 880, gain: 0.05, dur: 0.24, delay: i * 0.5 + 0.25 });
      }
    },
    bossPhase() {
      if (!ready()) return;
      hiss({ gain: 0.2, dur: 0.5, freq: 500, to: 60 });
      tone({ freq: 90, to: 45, type: "sine", gain: 0.25, dur: 0.4 });
    },
    bossKill() {
      if (!ready()) return;
      for (let i = 0; i < 6; i++) hiss({ gain: 0.18, dur: 0.3, freq: 1500 - i * 150, to: 120, delay: i * 0.2 });
      hiss({ gain: 0.4, dur: 1.1, freq: 700, to: 50, delay: 1.2 });
      tone({ freq: 80, to: 30, type: "sine", gain: 0.45, dur: 0.9, delay: 1.2 });
    },
    deflect() {
      if (!ready() || !allow("deflect", 80)) return;
      tone({ freq: 2600, to: 2200, type: "triangle", gain: 0.03, dur: 0.04 });
    },
    sector() {
      if (!ready()) return;
      arp([523, 659, 784, 1047, 1319], 0.08, { gain: 0.08 });
    },
    dead() {
      if (!ready()) return;
      tone({ freq: 500, to: 40, type: "sawtooth", gain: 0.15, dur: 0.9 });
      hiss({ gain: 0.35, dur: 0.9, freq: 1200, to: 60 });
    },
    record() {
      if (!ready()) return;
      arp([523, 659, 784, 1047, 784, 1047, 1319], 0.09, { gain: 0.08, type: "square" });
    },
    mission() {
      if (!ready()) return;
      arp([784, 1047, 1568], 0.08, { gain: 0.08, type: "triangle" });
    },
    buy() {
      if (!ready()) return;
      arp([988, 1319], 0.07, { gain: 0.08 });
    },
    tick(i) {
      if (!ready() || !allow("tick", 40)) return;
      tone({ freq: noteFor(i % 15, 1047), type: "square", gain: 0.02, dur: 0.03 });
    },
    ui() {
      if (!ready()) return;
      tone({ freq: 900, to: 700, type: "sine", gain: 0.06, dur: 0.05 });
    },
  };
}

// Vibração: no app nativo usa o motor do aparelho (iPhone incluso); no
// navegador, navigator.vibrate onde existir (Android). pattern em ms.
const native = Capacitor.isNativePlatform();

export function buzz(pattern) {
  try {
    if (native) {
      const strong = Array.isArray(pattern) || pattern >= 15;
      Haptics.impact({ style: strong ? ImpactStyle.Heavy : ImpactStyle.Light }).catch(() => {});
    } else {
      navigator.vibrate?.(pattern);
    }
  } catch {
    // sem vibração
  }
}
