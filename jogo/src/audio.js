// Sons sintetizados com Web Audio (nenhum arquivo de áudio) e vibração curta.
// O contexto só nasce no primeiro toque, como exigem iOS e Chrome.
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle } from "@capacitor/haptics";

// Escala pentatônica: qualquer sequência de notas soa bem, então o combo vira melodia.
const PENTATONIC = [0, 2, 4, 7, 9];

export function noteFor(step, root) {
  const i = Math.min(step, 14);
  const semis = 12 * Math.floor(i / 5) + PENTATONIC[i % 5];
  return root * 2 ** (semis / 12);
}

export function createAudio() {
  let ctx = null;
  let master = null;
  let noise = null;
  let muted = false;

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.8;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.2, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  }

  function ready() {
    return ctx && !muted && ctx.state === "running";
  }

  // Um tom com ataque rápido e queda exponencial.
  function tone({ freq, to = freq, type = "sine", gain = 0.3, attack = 0.005, dur = 0.3, delay = 0 }) {
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function hiss({ gain = 0.15, dur = 0.08, freq = 2400 }) {
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    const t = ctx.currentTime;
    src.buffer = noise;
    filter.type = "bandpass";
    filter.frequency.value = freq;
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(master);
    src.start(t);
    src.stop(t + dur);
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.8;
    },
    // Bloco cortado: batida seca, mais grave quanto mais se perdeu.
    cut(kept) {
      if (!ready()) return;
      tone({ freq: 140 + kept * 120, to: 70, type: "triangle", gain: 0.35, dur: 0.12 });
      hiss({ gain: 0.08, dur: 0.06, freq: 1800 });
    },
    // Perfeito: a próxima nota da melodia, com um brilho uma oitava acima.
    perfect(combo, root) {
      if (!ready()) return;
      const f = noteFor(combo - 1, root);
      tone({ freq: f, type: "triangle", gain: 0.32, dur: 0.45 });
      tone({ freq: f * 2, gain: 0.08, dur: 0.3 });
    },
    grow() {
      if (!ready()) return;
      tone({ freq: 520, to: 1040, gain: 0.07, dur: 0.18, delay: 0.06 });
    },
    miss() {
      if (!ready()) return;
      tone({ freq: 260, to: 55, type: "sawtooth", gain: 0.12, attack: 0.01, dur: 0.55 });
      hiss({ gain: 0.12, dur: 0.18, freq: 600 });
    },
    win(root) {
      if (!ready()) return;
      [0, 2, 4, 5, 7].forEach((step, i) =>
        tone({ freq: noteFor(step, root), type: "triangle", gain: 0.22, dur: 0.5, delay: i * 0.08 }),
      );
    },
    star(i, root) {
      if (!ready()) return;
      const f = noteFor(5 + i * 2, root);
      tone({ freq: f, type: "sine", gain: 0.25, dur: 0.7 });
      tone({ freq: f * 1.5, gain: 0.06, dur: 0.5 });
    },
    ui() {
      if (!ready()) return;
      tone({ freq: 900, to: 700, type: "sine", gain: 0.08, dur: 0.05 });
    },
  };
}

// Vibração: no app nativo usa o motor de vibração do aparelho (iPhone incluso);
// no navegador, navigator.vibrate onde existir (Android). pattern em ms.
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
