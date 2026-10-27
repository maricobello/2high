// Fases em ordem de dificuldade. speed em unidades do mundo por segundo,
// tolerance é a margem do perfeito, sway a amplitude do balanço da torre,
// jitter a variação aleatória de velocidade por bloco, hue o tom dos blocos.
export const PHASES = [
  {
    name: "Alicerce",
    hint: "Toque para soltar o bloco.",
    target: 10, speed: 150, easing: "linear", sway: 0, jitter: 0,
    tolerance: 7, startWidth: 1, hue: 192, bg: ["#173457", "#0a1626"],
  },
  {
    name: "Térreo",
    hint: "Um pouco mais rápido.",
    target: 12, speed: 185, easing: "linear", sway: 0, jitter: 0,
    tolerance: 6, startWidth: 1, hue: 328, bg: ["#3d1d42", "#170a1d"],
  },
  {
    name: "Andaime",
    hint: "Acelera no meio, freia nas pontas.",
    target: 14, speed: 190, easing: "sine", sway: 0, jitter: 0,
    tolerance: 6, startWidth: 1, hue: 158, bg: ["#0f3d3a", "#061c1b"],
  },
  {
    name: "Vento",
    hint: "A torre balança. Acompanhe.",
    target: 14, speed: 195, easing: "linear", sway: 16, jitter: 0,
    tolerance: 6, startWidth: 1, hue: 252, bg: ["#2a2c63", "#10112b"],
  },
  {
    name: "Guindaste",
    hint: "Cada bloco vem num ritmo.",
    target: 15, speed: 210, easing: "linear", sway: 0, jitter: 0.35,
    tolerance: 6, startWidth: 1, hue: 32, bg: ["#4a2a10", "#1d1006"],
  },
  {
    name: "Mirante",
    hint: "Blocos mais estreitos.",
    target: 16, speed: 220, easing: "sine", sway: 0, jitter: 0,
    tolerance: 5.5, startWidth: 0.72, hue: 204, bg: ["#0d2f4a", "#04121f"],
  },
  {
    name: "Arranha-céu",
    hint: "Ritmo, vento e surpresa.",
    target: 18, speed: 240, easing: "sine", sway: 12, jitter: 0.2,
    tolerance: 5.5, startWidth: 1, hue: 352, bg: ["#3f0e20", "#17040b"],
  },
  {
    name: "Cobertura",
    hint: "Tudo junto. Margem menor.",
    target: 20, speed: 260, easing: "linear", sway: 18, jitter: 0.3,
    tolerance: 5, startWidth: 1, hue: 46, bg: ["#2b2410", "#0f0c04"],
  },
];
