// Regras puras do jogo: sem DOM, sem tempo real. Tudo aqui é testado em tests/.
// Blocos são { x, w }: x é o centro, w a largura, em unidades do mundo.

// Solta o bloco em movimento sobre o de baixo.
// perfect: encaixou dentro da tolerância (não corta nada).
// cut: ficou só a sobreposição; debris é o pedaço que cai.
// miss: não sobrou nada, fim de partida.
export function placeBlock(below, moving, tolerance) {
  if (Math.abs(moving.x - below.x) <= tolerance) {
    return { kind: "perfect", block: { x: below.x, w: moving.w }, kept: 1 };
  }
  const ml = moving.x - moving.w / 2;
  const mr = moving.x + moving.w / 2;
  const left = Math.max(ml, below.x - below.w / 2);
  const right = Math.min(mr, below.x + below.w / 2);
  const w = right - left;
  if (w <= 0) return { kind: "miss" };
  const debris =
    moving.x > below.x
      ? { x: (right + mr) / 2, w: mr - right }
      : { x: (ml + left) / 2, w: left - ml };
  return { kind: "cut", block: { x: (left + right) / 2, w }, debris, kept: w / moving.w };
}

// A partir do 3º perfeito seguido, cada perfeito devolve um pouco de largura.
export function grownWidth(w, combo, base, step) {
  return combo >= 3 ? Math.min(base, w + step) : w;
}

// Posição do bloco deslizante. p é o progresso em voltas completas (ida e volta);
// começa em -range. "sine" acelera no meio e freia nas pontas.
export function sliderPosition(p, range, easing) {
  const u = p - Math.floor(p);
  if (easing === "sine") return -range * Math.cos(2 * Math.PI * u);
  return u < 0.5 ? -range + 4 * u * range : 3 * range - 4 * u * range;
}

export function starThresholds(target) {
  return [Math.ceil(target * 0.35), Math.ceil(target * 0.65)];
}

// Estrelas de uma fase concluída.
export function starsFor(perfects, target) {
  const [two, three] = starThresholds(target);
  return perfects >= three ? 3 : perfects >= two ? 2 : 1;
}

// Regras do modo Infinito: mais rápido a cada andar, novas regras aos poucos.
export function endlessRules(height) {
  return {
    speed: Math.min(170 + height * 3.5, 330),
    easing: height >= 15 && Math.floor(height / 15) % 2 === 1 ? "sine" : "linear",
    sway: height >= 30 ? Math.min(8 + (height - 30) * 0.3, 22) : 0,
    jitter: height >= 45 ? Math.min(0.15 + (height - 45) * 0.005, 0.35) : 0,
    tolerance: Math.max(4, 7 - height * 0.03),
  };
}

// Progresso salvo: estrelas por fase (0 a 3), recorde do Infinito e som.
export function defaultProgress(phaseCount) {
  return { stars: Array(phaseCount).fill(0), best: 0, muted: false };
}

export function sanitizeProgress(raw, phaseCount) {
  const p = defaultProgress(phaseCount);
  if (!raw || typeof raw !== "object") return p;
  if (Array.isArray(raw.stars)) {
    for (let i = 0; i < phaseCount; i++) {
      const s = Math.floor(Number(raw.stars[i]));
      p.stars[i] = Number.isFinite(s) ? Math.min(3, Math.max(0, s)) : 0;
    }
  }
  const best = Math.floor(Number(raw.best));
  p.best = Number.isFinite(best) && best > 0 ? best : 0;
  p.muted = raw.muted === true;
  return p;
}

export function applyPhaseResult(progress, index, stars) {
  const next = { ...progress, stars: [...progress.stars] };
  next.stars[index] = Math.max(next.stars[index], stars);
  return next;
}

export function applyEndlessResult(progress, height) {
  return { ...progress, best: Math.max(progress.best, height) };
}

export function isPhaseUnlocked(progress, index) {
  return index === 0 || progress.stars[index - 1] > 0;
}

export const ENDLESS_UNLOCK_INDEX = 2;

export function isEndlessUnlocked(progress) {
  return progress.stars[ENDLESS_UNLOCK_INDEX] > 0;
}

export function nextPhaseToPlay(progress) {
  const i = progress.stars.findIndex((s) => s === 0);
  return i === -1 ? progress.stars.length - 1 : i;
}
