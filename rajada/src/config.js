// Números do jogo. Mudar aqui muda o balanceamento; os testes e o simulador
// de bots (npm run balance) mostram o efeito.

export const W = 224; // largura do mundo em pixels (a altura acompanha a tela)
export const STEP = 1 / 120; // passo fixo da simulação

export const PLAYER = {
  keySpeed: 150, // px/s com teclado
  followSpeed: 560, // px/s máximo seguindo o dedo ou o mouse
  topLimit: 0.32, // não sobe acima de 32% da altura
  bottomMargin: 12,
  invuln: 1.6, // s piscando depois de levar dano
  grazeR: 9, // raio do raspão em volta do centro
  shieldInvuln: 1, // s de proteção depois que o escudo quebra
};

// engines: posição das chamas no sprite (x, y do canto de cima à esquerda)
export const SHIPS = {
  faisca: {
    name: "Faísca",
    sprite: "faisca",
    hp: 3,
    speed: 1,
    hitR: 1.5,
    gun: 1,
    rockets: 0,
    drones: 0,
    engines: [[5, 14], [8, 14]],
    perk: "Equilibrada.",
  },
  vespa: {
    name: "Vespa",
    sprite: "vespa",
    hp: 2,
    speed: 1.2,
    hitR: 1,
    gun: 2,
    rockets: 0,
    drones: 0,
    engines: [[5, 14], [7, 14]],
    perk: "Rápida, centro menor, metralhadora nv 2. Um casco a menos.",
    unlock: { kind: "sector", n: 3, text: "Chegue ao setor 3" },
  },
  bigorna: {
    name: "Bigorna",
    sprite: "bigorna",
    hp: 4,
    speed: 0.9,
    hitR: 2,
    gun: 1,
    rockets: 0,
    drones: 1,
    engines: [[6, 14], [9, 14]],
    perk: "Um casco a mais e começa com um drone. Mais lenta.",
    unlock: { kind: "bosses", n: 5, text: "Derrote 5 chefes" },
  },
  cometa: {
    name: "Cometa",
    sprite: "cometa",
    hp: 3,
    speed: 1,
    hitR: 1.5,
    gun: 1,
    rockets: 2,
    drones: 0,
    engines: [[5, 14], [8, 14]],
    perk: "Começa com foguetes nv 2.",
    unlock: { kind: "missions", n: 12, text: "Cumpra 12 missões" },
  },
};
export const SHIP_ORDER = ["faisca", "vespa", "bigorna", "cometa"];

// Metralhadora sem teto. Canos: [dx, ângulo em graus]. A forma do nível
// (GUN_FORMS) escolhe o padrão; as formas acumulam o que as anteriores davam.
// Cadência: de `every` no nível 1 até `fastest` no nível `fastAt`, e para aí.
const LEQUE = [[0, 0], [-4, -5], [4, 5], [-6, -13], [6, 13]];
const PESADA = [...LEQUE, [-8, -20], [8, 20]];
const TEMPESTADE = [...PESADA, [-10, -28], [10, 28]];
export const GUN = {
  speed: 330,
  every: 0.125,
  fastest: 0.075,
  fastAt: 30,
  bigMult: 1.4, // dano dos tiros grandes (Pesada em diante)
  homingLife: 1.2, // s de vida do tiro teleguiado
  homingTurn: 6, // rad/s
  homingRetarget: 0.25, // s entre uma escolha de alvo e outra
  beam: { width: 4, tick: 0.1, mult: 1.2 }, // Raio: dano 1,2 × nível a cada tique
  // homing: os 2 canos de fora (os últimos da lista) curvam atrás do alvo;
  // sway: graus que o leque balança, para um lado nas rajadas pares e para o outro nas ímpares
  patterns: {
    rajada: { byLevel: [[[0, 0]], [[-3, 0], [3, 0]], [[0, 0], [-4, -7], [4, 7]], [[-3, 0], [3, 0], [-5, -11], [5, 11]]] },
    leque: { streams: LEQUE },
    pesada: { streams: PESADA, big: true },
    perfurante: { streams: PESADA, big: true, pierce: 1 },
    cacadora: { streams: PESADA, big: true, pierce: 1, homing: true },
    raio: { streams: PESADA.slice(1), big: true, pierce: 1, homing: true, beam: true },
    tempestade: { streams: TEMPESTADE, big: true, pierce: 1, homing: true, beam: true, sway: 6 },
    estelar: { streams: TEMPESTADE, big: true, pierce: 1, homing: true, beam: true, sway: 6 },
  },
};

// Foguetes por nível (a linha vale de `from` em diante). Dano e explosão
// crescem com o nível; do 15 em diante cada explosão solta `frag` estilhaços
// e, a cada 5 níveis depois do 15, a explosão fica 10% maior (até 2×).
export const ROCKETS = {
  steps: [
    { from: 1, every: 1, count: 1 },
    { from: 2, every: 1, count: 2 },
    { from: 3, every: 0.7, count: 2 },
    { from: 4, every: 0.7, count: 4 },
    { from: 5, every: 0.6, count: 6 },
    { from: 10, every: 0.5, count: 8 },
  ],
  dmg: 4,
  splash: 12,
  splashDmg: 2,
  fragFrom: 15,
  frag: 4,
  shardSpeed: 160, // estilhaços saem em X (45°, 135°, 225° e 315°)
  shardLife: 0.35,
  splashGrow: 0.1,
  splashMax: 2,
  startSpeed: 50,
  accel: 420,
  maxSpeed: 270,
  turn: 5, // rad/s
  life: 2.4,
};

// Drones: até 4 (um por nível); depois do 4 a cadência sobe 5% por nível (até
// 2×) e do 10 em diante cada drone atira um raio curto (beam).
export const DRONES = {
  max: 4,
  every: 0.18,
  speedUp: 0.05,
  speedMax: 2,
  dmg: 0.8,
  fanFrom: 5, // dois tiros em leque de ±6°
  beam: { from: 10, len: 40, mult: 1.5, tick: 0.1 },
  offset: [[-18, 6], [18, 6], [-28, 14], [28, 14]],
};

// Poder sem teto: dano cresce a cada nível; a cor do tiro troca a cada 5 níveis
// (faixa) e vira arco-íris na faixa 10; do 35 em diante, uma ★ a cada 5 níveis.
// ramps: [claro, médio, escuro] de cada faixa, do branco (0) ao dourado (9).
export const POWER = {
  perLevel: 0.1,
  starFrom: 35,
  starEvery: 5,
  starBonus: 0.15,
  band: 5,
  rainbowBand: 10,
  ramps: [
    ["#ffffff", "#f4f7ff", "#b9c3dc"],
    ["#fff4b0", "#ffd23f", "#ff8a2a"],
    ["#ffd9a8", "#ff8a2a", "#b4501a"],
    ["#ffb3b3", "#ff3d55", "#9c1a33"],
    ["#ffb3dc", "#ff5fb4", "#a01f72"],
    ["#d6bcff", "#a46bff", "#5a2fae"],
    ["#7cb4ff", "#3d6bff", "#2c3f86"],
    ["#c4fcff", "#48e4f0", "#3d6bff"],
    ["#b6ffc4", "#4ee36a", "#1d8f45"],
    ["#ffffff", "#ffd23f", "#c8902a"],
  ],
};

// Formas da metralhadora: a partir do nível `at`.
export const GUN_FORMS = [
  { at: 1, id: "rajada", name: "Rajada" },
  { at: 5, id: "leque", name: "Leque" },
  { at: 10, id: "pesada", name: "Pesada" },
  { at: 15, id: "perfurante", name: "Perfurante" },
  { at: 20, id: "cacadora", name: "Caçadora" },
  { at: 25, id: "raio", name: "Raio" },
  { at: 30, id: "tempestade", name: "Tempestade" },
  { at: 35, id: "estelar", name: "Estelar" },
];

// Tetos de desempenho: inimigos, tiros inimigos e tiros da nave na tela
// (acima do teto de tiros da nave, os mais antigos somem primeiro).
export const PERF = { enemies: 60, shots: 220, bullets: 260 };

export const TURBO = { full: 50, dur: 6, perGraze: 0.7, fireMult: 0.5, scoreMult: 2 };
export const COMBO = { window: 1.6, perStep: 6, max: 8 };

// cristal: [chance, mínimo, máximo]; cap: sempre solta cápsula
export const ENEMIES = {
  zangao: { sprite: "zangao", hp: 1, score: 10, threat: 1, turbo: 1, cristal: [0.18, 1, 1], box: [9, 6] },
  dardo: { sprite: "dardo", hp: 2, score: 25, threat: 1.5, turbo: 1.5, cristal: [0.3, 1, 1], box: [7, 9] },
  atirador: { sprite: "atirador", hp: 6, score: 60, threat: 3, turbo: 3, cristal: [0.6, 1, 2], box: [11, 8] },
  couracado: { sprite: "couracado", hp: 30, score: 250, threat: 7, turbo: 8, cristal: [1, 3, 5], cap: true, box: [21, 19] },
  pedra_g: { sprite: "pedra_g", hp: 8, score: 30, threat: 2, turbo: 1, cristal: [0.4, 1, 2], split: "pedra_m", box: [13, 13] },
  pedra_m: { sprite: "pedra_m", hp: 3, score: 15, threat: 1, turbo: 0.5, cristal: [0.2, 1, 1], split: "pedra_p", box: [8, 8] },
  pedra_p: { sprite: "pedra_p", hp: 1, score: 5, threat: 0.3, turbo: 0.3, cristal: [0.1, 1, 1], box: [5, 5] },
  mina: { sprite: "mina", hp: 3, score: 30, threat: 1.5, turbo: 1, cristal: [0.3, 1, 1], box: [7, 7] },
  portador: { sprite: "portador", hp: 7, score: 100, threat: 0, turbo: 3, cristal: [1, 2, 3], cap: true, box: [15, 7] },
};

// Tiros inimigos: raio de acerto (o sprite é maior, o que machuca é o miolo)
export const SHOTS = {
  bala: { r: 2, sprite: "bala" },
  bolha: { r: 2.6, sprite: "bolha" },
  orbe: { r: 2.6, sprite: "orbe" },
  agulha: { r: 1.5, sprite: "agulha" },
};

export const SECTORS = [
  { name: "Órbita Baixa", bg: ["#0b1534", "#03050d"], star: "#9fb4ff", nebula: ["#2c3f86", "#5a2fae"] },
  { name: "Cinturão", bg: ["#24170f", "#070509"], star: "#ffd9a8", nebula: ["#7a4a2a", "#b4501a"], rocks: true },
  { name: "Nebulosa", bg: ["#2a1140", "#07040f"], star: "#ffc4f0", nebula: ["#a01f72", "#5a2fae"] },
  { name: "Fronteira", bg: ["#082c2e", "#03080b"], star: "#b8fff2", nebula: ["#1d8f45", "#2c3f86"] },
  { name: "Abismo", bg: ["#2c0812", "#050206"], star: "#ffb3b3", nebula: ["#9c1a33", "#a01f72"] },
];

export function sectorInfo(n) {
  const base = SECTORS[(n - 1) % SECTORS.length];
  const lap = Math.floor((n - 1) / SECTORS.length);
  return { ...base, name: lap ? `${base.name} ${["", "II", "III", "IV", "V"][Math.min(lap, 4)]}` : base.name, lap };
}

// Duração do setor (s) até o chefe.
export function sectorLength(n, firstRun = false) {
  if (firstRun && n === 1) return 40;
  return Math.min(80, 48 + 6 * n);
}

// Dificuldade por setor.
export function sectorScale(n) {
  const s = n - 1;
  return {
    hp: 1 + 0.25 * s,
    shotSpeed: Math.min(1.6, 1 + 0.07 * s),
    fire: 1 + 0.28 * s,
    cap: 9 + 5 * s,
    gap: 2.4 / (1 + 0.18 * s),
  };
}

export const WAVES = [
  { id: "fila", min: 1, weight: 3, threat: 5 },
  { id: "v", min: 1, weight: 3, threat: 7 },
  { id: "serpente", min: 1, weight: 2, threat: 6 },
  { id: "dardos", min: 1, weight: 2, threat: 4.5 },
  { id: "atiradores", min: 1, weight: 2, threat: 6 },
  { id: "pedras", min: 1, weight: 1.2, threat: 6 },
  { id: "couracado", min: 1, weight: 1, threat: 10, after: 25 },
  { id: "minas", min: 2, weight: 1.5, threat: 6 },
  { id: "pinca", min: 2, weight: 2, threat: 8 },
  { id: "chuva", min: 3, weight: 1.5, threat: 8 },
];

export const BOSSES = [
  { id: "colosso", name: "Colosso", sprite: "colosso", hp: 300, score: 5000, y: 0.2, box: [55, 30] },
  { id: "aranha", name: "Aranha", sprite: "aranha", hp: 380, score: 6000, y: 0.22, box: [30, 30] },
  { id: "olho", name: "Olho", sprite: "olho", hp: 440, score: 7000, y: 0.23, box: [34, 32] },
];

export const DIRECTOR = {
  cycle: [14, 6, 4], // subida, pico, alívio (s)
  floor: 0.45, // tensão no começo da subida
  relax: 0.2, // tensão no alívio
  mercy: 2.5, // s sem ondas novas depois de dano
  lowHpCap: 0.8, // ameaça máxima com casco em 1
  pressureAfter: 45, // s sem dano, casco cheio e armas fortes: mais pressão
  pressureCap: 1.15,
};

export const DROPS = {
  killBase: 0.004, // chance de cápsula por abate
  pityPerSec: 0.0015, // + chance por segundo sem cápsula
  pityMax: 0.12,
  carrierAfter: 18, // s sem cápsula: aparece um Portador
  coolH: 45, // s sem outro Reparo depois de um
  coolE: 30, // s sem outro Escudo depois de um
  perSector: 0.12, // cada setor deixa as cápsulas comuns 12% mais raras
  recoverBoost: 6, // s de vantagem na garantia depois de perder arma
  recoverFor: 12, // s em que a arma perdida tem peso triplo
};

export const BOSS_DROPS = { cristais: 30, caps: 2 };
export const SECTOR_BONUS = { perSector: 1000, noHit: 2000 };

export const UPGRADES = {
  casco: { name: "Casco", costs: [150, 600], text: (n) => `+${n} de casco máximo` },
  canhao: { name: "Canhão", costs: [100, 350, 900], text: (n) => `Começa com metralhadora nv ${1 + n}` },
  ima: { name: "Ímã", costs: [60, 180, 400, 800], radius: [16, 24, 34, 46, 60], text: (n) => `Puxa cristais a ${[16, 24, 34, 46, 60][n]} px` },
  escudo: {
    name: "Escudo",
    costs: [200, 500, 1000],
    regen: [0, 0, 40, 25],
    text: (n) => (n === 1 ? "Começa com escudo" : `Escudo volta sozinho a cada ${[0, 0, 40, 25][n]} s`),
  },
  sorte: { name: "Sorte", costs: [120, 400, 900], mult: [1, 1.15, 1.3, 1.5], text: (n) => `+${[0, 15, 30, 50][n]}% de cápsulas` },
  foguetes: { name: "Foguetes", costs: [250, 750], text: (n) => `Começa com foguetes nv ${n}` },
};
export const UPGRADE_ORDER = ["canhao", "ima", "casco", "escudo", "sorte", "foguetes"];

export const RANKS = ["Cadete", "Aspirante", "Piloto", "Tenente", "Capitão", "Major", "Coronel", "Comandante", "Brigadeiro", "Almirante", "Lenda"];
export const MISSIONS_PER_RANK = 3;
export const RANK_BONUS = 0.05; // +5% de cristais por patente
export const RANK_BONUS_MAX = 0.5;
export const BREAK_AFTER = 45 * 60; // s de jogo seguidos até sugerir pausa
