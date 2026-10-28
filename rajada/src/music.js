// Música chiptune gerada em tempo real (nenhum arquivo de áudio).
// Três músicas: "menu" (calma), "voo" (partida) e "chefe". Baixo e bateria
// tocam sempre; o arpejo entra com a tensão e a melodia no pico e no TURBO.
// Agendamento com antecedência (padrão "A Tale of Two Clocks").

const N = (name) => {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] ? 1 : 0);
  return 12 * (Number(m[3]) + 1) + base;
};
const freq = (midi) => 440 * 2 ** ((midi - 69) / 12);

// Melodia: uma nota por colcheia ("-" segura, "." pausa).
const parse = (str) => str.trim().split(/\s+/).map((tok) => (tok === "." ? null : tok === "-" ? "-" : N(tok)));

const SONGS = {
  voo: {
    bpm: 138,
    chords: [
      ["A2", ["A3", "C4", "E4", "A4"]],
      ["F2", ["F3", "A3", "C4", "F4"]],
      ["C3", ["C4", "E4", "G4", "C5"]],
      ["G2", ["G3", "B3", "D4", "G4"]],
    ],
    lead: parse(`
      E5 - D5 C5 A4 - C5 D5   E5 - G5 - E5 D5 C5 -
      C5 - D5 E5 G5 - E5 D5   D5 - B4 - G4 - . .
    `),
    drums: "k.h.s.h.k.h.s.hk",
  },
  chefe: {
    bpm: 156,
    chords: [
      ["D2", ["D4", "F4", "A4", "D5"]],
      ["A#1", ["A#3", "D4", "F4", "A#4"]],
      ["G2", ["G3", "A#3", "D4", "G4"]],
      ["A2", ["A3", "C#4", "E4", "A4"]],
    ],
    lead: parse(`
      D5 - F5 - A5 - G5 F5    F5 - E5 D5 A#4 - D5 -
      G5 - F5 D5 A#4 - G4 -   A4 - C#5 - E5 - A5 -
    `),
    drums: "k.hsk.hsk.hsk.ss",
    drive: true,
  },
  menu: {
    bpm: 96,
    chords: [
      ["A2", ["A3", "C4", "E4", "G4"]],
      ["F2", ["F3", "A3", "C4", "E4"]],
      ["C3", ["C4", "E4", "G4", "B4"]],
      ["E2", ["E3", "G#3", "B3", "E4"]],
    ],
    lead: null,
    drums: "....h.......h...",
    soft: true,
  },
};

export function createMusic(getCtx, getDest) {
  let song = null;
  let name = null;
  let step = 0;
  let nextTime = 0;
  let timer = null;
  let intensity = 0.4;
  let lift = false;
  let pulse = null;
  let noise = null;

  function waves(ctx) {
    if (!pulse) {
      // onda quadrada de 25% (timbre de videogame antigo)
      const n = 32;
      const re = new Float32Array(n);
      const im = new Float32Array(n);
      for (let k = 1; k < n; k++) im[k] = ((2 / (k * Math.PI)) * Math.sin(k * Math.PI * 0.25)) * 0.9;
      pulse = ctx.createPeriodicWave(re, im);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.3, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
  }

  function note(ctx, dest, t, midi, dur, { type = "square", gain = 0.1, wave = null } = {}) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    if (wave) osc.setPeriodicWave(wave);
    else osc.type = type;
    osc.frequency.setValueAtTime(freq(midi), t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(gain * 0.55, t + dur * 0.4);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function drum(ctx, dest, t, kind) {
    if (kind === "k") {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      env.gain.setValueAtTime(0.5, t);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      osc.connect(env).connect(dest);
      osc.start(t);
      osc.stop(t + 0.18);
      return;
    }
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const env = ctx.createGain();
    src.buffer = noise;
    filter.type = kind === "h" ? "highpass" : "bandpass";
    filter.frequency.value = kind === "h" ? 7000 : 1800;
    const dur = kind === "h" ? 0.03 : 0.12;
    env.gain.setValueAtTime(kind === "h" ? 0.08 : 0.22, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(env).connect(dest);
    src.start(t);
    src.stop(t + dur + 0.01);
  }

  function schedule() {
    const ctx = getCtx();
    const dest = getDest();
    if (!ctx || !dest || !song) return;
    waves(ctx);
    const sixteenth = 60 / song.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % song.chords.length;
      const s = step % 16;
      const [root, tones] = song.chords[bar];
      const t = nextTime;
      // baixo: colcheias (semicolcheias no chefe) alternando oitava
      if (song.drive || s % 2 === 0) {
        const up = s % 4 === 2;
        note(ctx, dest, t, N(root) + (up ? 12 : 0), sixteenth * (song.drive ? 0.9 : 1.8), { type: "triangle", gain: song.soft ? 0.16 : 0.2 });
      }
      // arpejo
      if (song.soft || intensity > 0.45 || lift) {
        const tone = tones[s % 4];
        note(ctx, dest, t, N(tone) + (song.soft ? 12 : 0), sixteenth * 0.9, { wave: pulse, gain: song.soft ? 0.035 : 0.04 });
      }
      // melodia
      if (song.lead && (intensity > 0.8 || lift) && s % 2 === 0) {
        const idx = (Math.floor(step / 2) % song.lead.length + song.lead.length) % song.lead.length;
        const m = song.lead[idx];
        if (m && m !== "-") {
          let len = 1;
          while (song.lead[(idx + len) % song.lead.length] === "-" && len < 4) len += 1;
          note(ctx, dest, t, m, sixteenth * 2 * len * 0.95, { wave: pulse, gain: 0.06 });
        }
      }
      const d = song.drums[s];
      if (d !== "." && (!song.soft || d === "h")) drum(ctx, dest, t, d);
      nextTime += sixteenth;
      step += 1;
    }
  }

  return {
    play(which) {
      if (name === which) return;
      name = which;
      song = SONGS[which] ?? null;
      step = 0;
      const ctx = getCtx();
      nextTime = ctx ? ctx.currentTime + 0.06 : 0;
      if (!timer) timer = setInterval(schedule, 30);
    },
    stop() {
      name = null;
      song = null;
      clearInterval(timer);
      timer = null;
    },
    // tensão da partida (0 a 1) e TURBO: decidem as camadas
    setIntensity(v, turbo = false) {
      intensity = v;
      lift = turbo;
    },
    resync() {
      const ctx = getCtx();
      if (ctx) nextTime = Math.max(nextTime, ctx.currentTime + 0.05);
    },
    get current() {
      return name;
    },
  };
}
