// Telas, entrada e laço de quadros. Liga o motor (game.js) ao desenho, ao som
// e ao progresso salvo.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { PHASES } from "./phases.js";
import { createGame } from "./game.js";
import { createRenderer } from "./render.js";
import { createAudio, buzz } from "./audio.js";
import { loadProgress, saveProgress } from "./storage.js";
import {
  applyPhaseResult,
  applyEndlessResult,
  isPhaseUnlocked,
  isEndlessUnlocked,
  nextPhaseToPlay,
  starThresholds,
  ENDLESS_UNLOCK_INDEX,
} from "./core.js";

const $ = (id) => document.getElementById(id);
const STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';
const LOCK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10V8a5 5 0 0 1 10 0v2h1v11H6V10h1zm2 0h6V8a3 3 0 0 0-6 0v2z"/></svg>';
const SOUND_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM16 8.5a5 5 0 0 1 0 7l-1.4-1.4a3 3 0 0 0 0-4.2zM18.5 6a8.5 8.5 0 0 1 0 12l-1.4-1.4a6.5 6.5 0 0 0 0-9.2z"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4zM15.6 9l1.4-1.4 2 2 2-2L22.4 9l-2 2 2 2-1.4 1.4-2-2-2 2-1.4-1.4 2-2z"/></svg>';
// Nota base da melodia: sobe meio tom a cada fase, para cada fase soar diferente.
const ROOTS = [262, 277, 294, 311, 330, 349, 370, 392];
const ENDLESS_ROOT = 262;
const TAP_GUARD_MS = 450;

const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const renderer = createRenderer($("stage"), { reducedMotion });
const audio = createAudio();
let progress = loadProgress(PHASES.length);
audio.setMuted(progress.muted);

let session = null; // { mode, index, game }
let demo = null;
let screen = "home";
let resultShownAt = 0;
let resultAction = null;
let sessionCounter = 0;
let focus = null; // faixa livre da tela onde a câmera enquadra a torre

// ---------- telas ----------

function setScreen(name) {
  screen = name;
  const onHome = name === "home" || name === "phases";
  $("home").hidden = !onHome;
  $("phases").hidden = name !== "phases";
  $("home-bottom").hidden = name === "phases";
  $("hud").hidden = onHome;
  $("pause").hidden = name !== "pause";
  $("result").hidden = name !== "result";
  measureFocus();
}

// Espaço entre o que está por cima do canvas, para a torre não ficar escondida.
function measureFocus() {
  if (screen === "phases") return; // mantém o enquadramento do início
  if (screen === "home") {
    focus = { top: $("brand").getBoundingClientRect().bottom + 12, bottom: $("home-bottom").offsetTop - 12 };
  } else if (screen === "result") {
    const card = $("result").querySelector(".card");
    focus = { top: $("hud-label").getBoundingClientRect().bottom + 16, bottom: card.offsetTop - 16 };
  } else {
    focus = null;
  }
}

function goHome() {
  session = null;
  $("banner").hidden = true;
  renderHome();
  startDemo();
  setScreen("home");
}

function renderHome() {
  const next = nextPhaseToPlay(progress);
  $("play-sub").textContent = `Fase ${next + 1} · ${PHASES[next].name}`;
  const total = progress.stars.reduce((a, b) => a + b, 0);
  const done = progress.stars.filter((st) => st > 0).length;
  $("total-stars").textContent = `${total}/${PHASES.length * 3}`;
  $("total-stars").setAttribute("aria-label", `${total} de ${PHASES.length * 3} estrelas`);
  $("phases-sub").textContent = `${done} de ${PHASES.length} concluídas`;
  $("phases-stars").textContent = `★ ${total} de ${PHASES.length * 3}`;

  $("phase-list").innerHTML = PHASES.map((p, i) => {
    const unlocked = isPhaseUnlocked(progress, i);
    const stars = progress.stars[i];
    const label = unlocked
      ? `Fase ${i + 1}, ${p.name}, ${stars} de 3 estrelas`
      : `Fase ${i + 1} bloqueada`;
    const mini = [0, 1, 2].map((k) => `<span class="${k < stars ? "on" : ""}">★</span>`).join("");
    return `<li><button class="phase-tile${i === next ? " next" : ""}" type="button" data-i="${i}"
      aria-label="${label}"${unlocked ? "" : " disabled"}>
      ${unlocked ? `<span>${i + 1}</span><span class="mini-stars">${mini}</span>` : LOCK}
    </button></li>`;
  }).join("");

  const endless = $("btn-endless");
  if (isEndlessUnlocked(progress)) {
    endless.disabled = false;
    endless.innerHTML = `<span>Infinito</span><small>${progress.best ? `Recorde ${progress.best}` : "Sem recorde ainda"}</small>`;
  } else {
    endless.disabled = true;
    endless.innerHTML = `<span>${LOCK}Infinito</span><small>Libera na fase ${ENDLESS_UNLOCK_INDEX + 1}</small>`;
  }
  renderSound();
}

function renderSound() {
  const on = !progress.muted;
  $("btn-sound").innerHTML = on ? SOUND_ON : SOUND_OFF;
  $("btn-sound").setAttribute("aria-label", on ? "Som ligado" : "Som desligado");
  $("btn-sound").setAttribute("aria-pressed", String(on));
  $("btn-pause-sound").textContent = on ? "Som: ligado" : "Som: desligado";
}

function toggleSound() {
  progress = { ...progress, muted: !progress.muted };
  audio.setMuted(progress.muted);
  saveProgress(progress);
  renderSound();
  audio.ui();
}

function showBanner(eyebrow, title, hint) {
  const el = $("banner");
  $("banner-eyebrow").textContent = eyebrow;
  $("banner-title").textContent = title;
  $("banner-hint").textContent = hint;
  el.hidden = true;
  void el.offsetWidth; // reinicia a animação
  el.hidden = false;
  const id = sessionCounter;
  setTimeout(() => {
    if (id === sessionCounter) el.hidden = true;
  }, 2000);
}

let toastTimer = 0;
function toast(text) {
  const el = $("toast");
  el.textContent = text;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2600);
}

// ---------- partidas ----------

function startPhase(index) {
  const phase = PHASES[index];
  sessionCounter += 1;
  session = { mode: "phase", index, game: null };
  session.game = createGame({ mode: "phase", phase, onEvent: handler(session) });
  demo = null;
  setScreen("game");
  updateHud();
  showBanner(`Fase ${index + 1} de ${PHASES.length}`, phase.name, phase.hint);
}

function startEndless() {
  sessionCounter += 1;
  session = { mode: "endless", index: -1, game: null };
  session.game = createGame({ mode: "endless", best: progress.best, onEvent: handler(session) });
  demo = null;
  setScreen("game");
  updateHud();
  showBanner("Modo", "Infinito", "Fica mais rápido a cada andar.");
}

function restart() {
  if (session.mode === "phase") startPhase(session.index);
  else startEndless();
}

const rootFor = (s) => (s.mode === "phase" ? ROOTS[s.index] : ENDLESS_ROOT);

function handler(s) {
  return (type, data) => {
    if (s !== session) return;
    if (type === "perfect") {
      audio.perfect(data.combo, rootFor(s));
      if (data.grew) audio.grow();
      buzz(12);
      updateHud(true);
    } else if (type === "cut") {
      audio.cut(data.kept);
      buzz(6);
      updateHud(true);
    } else if (type === "miss") {
      audio.miss();
      buzz([30, 40, 60]);
    } else if (type === "won") {
      audio.win(rootFor(s));
      buzz([15, 30, 15]);
      updateHud(true);
      setTimeout(() => s === session && showWin(s, data), 1100);
    } else if (type === "lost") {
      showLost(s, data);
    }
  };
}

function updateHud(bump = false) {
  const g = session.game;
  const h = $("hud-height");
  h.textContent = String(g.height);
  if (bump && !reducedMotion) {
    h.classList.remove("bump");
    void h.offsetWidth;
    h.classList.add("bump");
  }
  if (session.mode === "phase") {
    const phase = PHASES[session.index];
    const [two, three] = starThresholds(phase.target);
    $("hud-label").textContent = `${phase.name} · ${g.height}/${phase.target}`;
    const lit = [g.status === "won", g.perfects >= two, g.perfects >= three];
    const goal = g.perfects >= three ? "" : `/${g.perfects >= two ? three : two}`;
    $("hud-right").innerHTML =
      `<div class="pips">${lit.map((on) => STAR.replace("<svg", `<svg class="${on ? "on" : ""}"`)).join("")}</div>` +
      `<span>perfeitos ${g.perfects}${goal}</span>`;
  } else {
    $("hud-label").textContent = "Infinito";
    $("hud-right").innerHTML = `<span>recorde</span><span class="record-value">${Math.max(progress.best, g.height)}</span>`;
  }
}

function showWin(s, data) {
  const i = s.index;
  const phase = PHASES[i];
  const wasEndlessLocked = !isEndlessUnlocked(progress);
  progress = applyPhaseResult(progress, i, data.stars);
  saveProgress(progress);

  const three = starThresholds(phase.target)[1];
  const missing = three - data.perfects;
  const isLast = i === PHASES.length - 1;
  showResult({
    eyebrow: `Fase ${i + 1} · ${phase.name}`,
    title: isLast ? "Torre completa" : "Fase concluída",
    sub:
      data.stars === 3
        ? `Fase perfeita: ${data.perfects} perfeitos.`
        : `Mais ${missing} ${missing === 1 ? "perfeito" : "perfeitos"} para 3 estrelas.`,
    stars: data.stars,
    primary: isLast ? ["Jogar Infinito", startEndless] : ["Próxima fase", () => startPhase(i + 1)],
    secondary: ["Repetir", () => startPhase(i)],
  });
  [...$("res-stars").children].slice(0, data.stars).forEach((el, k) =>
    setTimeout(() => {
      if (s !== session) return;
      el.classList.add("on");
      audio.star(k, rootFor(s));
      buzz(10);
    }, 260 + k * 280),
  );
  if (wasEndlessLocked && isEndlessUnlocked(progress)) {
    setTimeout(() => s === session && toast("Modo Infinito liberado"), 1300);
  }
}

function showLost(s, data) {
  if (s.mode === "phase") {
    const phase = PHASES[s.index];
    showResult({
      eyebrow: `Fase ${s.index + 1} · ${phase.name}`,
      title: data.remaining === 1 ? "Faltou 1 andar" : `Faltaram ${data.remaining} andares`,
      sub: `Você chegou a ${data.height} de ${phase.target}.`,
      meter: data.height / phase.target,
      primary: ["Tentar de novo", restart],
    });
    return;
  }
  const old = progress.best;
  const isRecord = data.height > old;
  progress = applyEndlessResult(progress, data.height);
  saveProgress(progress);
  const gap = old - data.height;
  showResult({
    eyebrow: "Infinito",
    title: isRecord ? `Novo recorde: ${data.height}` : `Altura ${data.height}`,
    sub: isRecord
      ? old
        ? `O anterior era ${old}.`
        : "Agora é só passar dele."
      : gap === 0
        ? "Igualou o recorde."
        : `Faltaram ${gap} para o recorde de ${old}.`,
    meter: isRecord ? undefined : data.height / old,
    primary: ["Tentar de novo", restart],
  });
  if (isRecord && old) buzz([10, 40, 10, 40, 20]);
}

function showResult({ eyebrow, title, sub, stars, meter, primary, secondary }) {
  $("res-eyebrow").textContent = eyebrow;
  $("res-title").textContent = title;
  $("res-sub").textContent = sub;
  $("res-stars").hidden = stars === undefined;
  $("res-stars").innerHTML = stars === undefined ? "" : STAR.repeat(3);
  $("res-meter").hidden = meter === undefined;
  const bar = $("res-meter").firstElementChild;
  bar.style.width = "0";
  if (meter !== undefined) requestAnimationFrame(() => (bar.style.width = `${Math.round(meter * 100)}%`));
  $("res-primary").firstElementChild.textContent = primary[0];
  $("res-secondary").parentElement.classList.toggle("single", !secondary);
  $("res-secondary").hidden = !secondary;
  if (secondary) $("res-secondary").textContent = secondary[0];
  resultAction = primary[1];
  $("res-primary").onclick = () => act(primary[1]);
  $("res-secondary").onclick = secondary ? () => act(secondary[1]) : null;
  resultShownAt = performance.now();
  setScreen("result");
}

function act(fn) {
  audio.unlock();
  audio.ui();
  fn();
}

function pause() {
  if (screen !== "game") return;
  setScreen("pause");
}

function resume() {
  setScreen("game");
}

// ---------- tela inicial: torre jogando sozinha ----------

function startDemo() {
  const phase = PHASES[nextPhaseToPlay(progress)];
  demo = createGame({ mode: "demo", phase, onEvent: (type) => type === "lost" && startDemo() });
  demo.aim = pickAim();
}

function pickAim() {
  return Math.random() < 0.6 ? 3 : 10 + Math.random() * 40;
}

function runDemo(dt) {
  demo.update(dt);
  const m = demo.moving;
  if (demo.status === "playing" && m && m.p > 0.12 && Math.abs(demo.offset()) < demo.aim) {
    demo.drop();
    demo.aim = pickAim();
  }
  if (demo.height >= 14 && demo.status === "playing") startDemo();
}

// ---------- entrada ----------

function primaryTap() {
  if (screen === "game") {
    session.game.drop();
  } else if (screen === "result" && performance.now() - resultShownAt > TAP_GUARD_MS) {
    act(resultAction);
  }
}

// No toque, só o pointerup conta como gesto que libera o áudio (iOS e Chrome).
$("app").addEventListener("pointerup", () => audio.unlock());
$("app").addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (e.button > 0) return;
  if (e.target.closest("button")) return;
  if (screen === "game" || (screen === "result" && !e.target.closest(".actions"))) primaryTap();
});

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  const onButton = e.target.closest?.("button");
  if (e.code === "Space" || e.code === "Enter") {
    if (onButton) return;
    e.preventDefault();
    audio.unlock();
    if (screen === "home") act(() => startPhase(nextPhaseToPlay(progress)));
    else primaryTap();
  } else if (e.code === "Escape" || e.code === "KeyP") {
    if (screen === "game") pause();
    else if (screen === "pause") resume();
    else if (screen === "phases") setScreen("home");
  } else if (e.code === "KeyM") {
    toggleSound();
  }
});

// Botão voltar do Android: pausa a partida, fecha a tela por cima e, no início, sai do jogo.
if (Capacitor.isNativePlatform()) {
  App.addListener("backButton", () => {
    if (screen === "game") pause();
    else if (screen === "home") App.exitApp();
    else goHome();
  });
}

document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});

$("btn-play").addEventListener("click", () => act(() => startPhase(nextPhaseToPlay(progress))));
$("btn-endless").addEventListener("click", () => act(startEndless));
$("btn-phases").addEventListener("click", () => act(() => setScreen("phases")));
$("btn-phases-close").addEventListener("click", () => act(() => setScreen("home")));
$("phase-list").addEventListener("click", (e) => {
  const tile = e.target.closest(".phase-tile");
  if (tile && !tile.disabled) act(() => startPhase(Number(tile.dataset.i)));
});
$("btn-sound").addEventListener("click", toggleSound);
$("btn-pause").addEventListener("click", () => act(pause));
$("btn-resume").addEventListener("click", () => act(resume));
$("btn-restart").addEventListener("click", () => act(restart));
$("btn-pause-sound").addEventListener("click", toggleSound);
$("btn-pause-menu").addEventListener("click", () => act(goHome));
$("res-menu").addEventListener("click", () => act(goHome));
window.addEventListener("resize", () => {
  renderer.resize();
  measureFocus();
});

// ---------- laço ----------

let last = performance.now();
function frame(now) {
  const dt = Math.min(1 / 30, (now - last) / 1000);
  last = now;
  const running = screen !== "pause";
  if (session) {
    if (running) session.game.update(dt);
    renderer.draw(session.game, running ? dt : 0, {
      record: session.mode === "endless" ? progress.best : 0,
      focus,
    });
  } else {
    runDemo(dt);
    renderer.draw(demo, dt, { focus });
  }
  requestAnimationFrame(frame);
}

goHome();
requestAnimationFrame(frame);

// Só para o teste automatizado (tests/smoke.mjs): leitura do estado com ?qa na URL.
if (new URLSearchParams(location.search).has("qa")) {
  window.__prumo = { game: () => session?.game ?? demo, screen: () => screen };
}

// Modo offline no site (PWA). O build liga isso; no app nativo e na prévia fica de fora.
if (typeof __PWA__ !== "undefined" && __PWA__ && "serviceWorker" in navigator && !window.Capacitor) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
