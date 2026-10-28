// Telas, entrada e laço de quadros. Liga a partida (game.js) ao desenho, ao
// som, ao progresso salvo e às telas de início, hangar, missões e resultado.
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { W, SHIPS, UPGRADES, TURBO, POWER, sectorInfo, BREAK_AFTER } from "./config.js";
import { bandOf, rampOf, weaponLabel, nextMilestone } from "./power.js";
import { createGame } from "./game.js";
import { createRenderer } from "./render.js";
import { createAudio, buzz } from "./audio.js";
import { createBot } from "./bot.js";
import { createRng, clamp } from "./rng.js";
import { tension } from "./director.js";
import { loadProfile, saveProfile, clearProfile } from "./storage.js";
import { createAnalytics, newInstallId } from "./analytics.js";
import { isDone, missionText } from "./missions.js";
import {
  defaultProfile,
  ensureMissions,
  loadoutFor,
  applyRun,
  buyUpgrade,
  rankOf,
  nextUpgradeGoal,
  affordableCount,
  dailyAvailable,
  localDay,
  struggling,
} from "./progress.js";
import { $, fmt, installIcons, missionItem, upgradesPanel, shipsPanel, statsPanel, causeBy, collectionData, collectionPanel } from "./ui.js";

const TAP_GUARD_MS = 700;
const TOUCH_SENS = 1.1;
const native = Capacitor.isNativePlatform();
const qa = new URLSearchParams(location.search).has("qa");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const frame = $("frame");
const renderer = createRenderer($("stage"), { reducedMotion });
const iconUrl = installIcons(renderer.sprites);
const audio = createAudio();
const rng = createRng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
let profile = ensureMissions(loadProfile(), rng);
const analytics = createAnalytics(() => profile, native ? Capacitor.getPlatform() : "web");
saveProfile(profile);
applySettings();

let screen = "home"; // home | game | pause | result | hangar | missions | settings
let overlayFrom = "home"; // de onde o hangar foi aberto (início ou resultado)
let session = null; // { game, worldH, announced: Set }
let demo = null;
let bot = null;
let worldH = 400;
let fit = 1;
let resultShownAt = 0;
let sessionPlay = 0;
let breakShown = false;
let installPrompt = null;
let autopilot = null; // só nos testes (?qa): o bot pilota a partida

// ---------- moldura e tamanho do mundo ----------

const probe = document.createElement("div");
probe.style.cssText = "position:absolute;visibility:hidden;padding-bottom:var(--safe-bottom)";
document.body.append(probe);

function chooseWorldH() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return vh / vw >= 1.4 ? clamp(Math.round((W * vh) / vw), 360, 520) : 400;
}

function layout() {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  if (!session) worldH = chooseWorldH();
  fit = Math.min(vw / W, vh / worldH);
  const fw = Math.round(W * fit);
  const fh = Math.round(worldH * fit);
  frame.style.setProperty("--fw", `${fw}px`);
  frame.style.setProperty("--fh", `${fh}px`);
  frame.classList.toggle("boxed", fw < vw - 4);
  renderer.resize(worldH);
  const g = session?.game;
  if (g) g.bottomInset = (parseFloat(getComputedStyle(probe).paddingBottom) || 0) / fit;
  else if (demo && demo.H !== worldH) startDemo();
  else fitDemo();
}

// ---------- telas ----------

const OVERLAYS = ["missions", "hangar", "settings", "collection", "pause", "result"];
// painéis abertos pela tela inicial: Esc e o voltar do Android fecham todos
const PANELS = ["hangar", "missions", "settings", "collection"];

function setScreen(name) {
  screen = name;
  const playing = name === "game" || name === "pause" || name === "result";
  $("home").hidden = playing || !(name === "home" || PANELS.includes(name));
  $("hud").hidden = !(name === "game" || name === "pause");
  for (const id of OVERLAYS) $(id).hidden = name !== id;
  if (name === "home" || PANELS.includes(name)) $("home").hidden = false;
  if (name !== "game") $("hint").hidden = true;
  if (name === "home") renderHome();
}

function goHome() {
  session = null;
  $("banner").hidden = true;
  layout();
  startDemo();
  audio.music.play("menu");
  setScreen("home");
}

function renderHome() {
  const s = profile.stats;
  const rank = rankOf(profile.missionsDone);
  $("rank-chip").textContent = rank.name;
  $("rank-chip").setAttribute("aria-label", `Patente ${rank.name}. Ver missões`);
  $("home-cristais").textContent = fmt(profile.cristais);
  $("play-sub").textContent = s.runs ? `Recorde ${fmt(s.best.score)} · Setor ${s.best.sector}` : "Primeiro voo";
  $("daily-chip").hidden = !(s.runs > 0 && dailyAvailable(profile, localDay()));
  const n = affordableCount(profile);
  const goal = nextUpgradeGoal(profile);
  $("hangar-sub").textContent = n
    ? `${n} ${n === 1 ? "melhoria disponível" : "melhorias disponíveis"}`
    : goal
      ? `Faltam ${fmt(goal.missing)} para ${UPGRADES[goal.key].name}`
      : "Tudo no máximo";
  $("hangar-badge").hidden = n === 0;
  $("missions-sub").textContent = `${rank.progress} de 3 para subir`;
  const col = collectionData(profile);
  $("collection-sub").textContent = `${col.bosses.filter((b) => b.kills).length} de ${col.bosses.length} chefes derrotados`;
  fitDemo();
}

// urgente: passa à frente da fila (sai logo depois do aviso que está na tela)
function showToast(text, urgent = false) {
  if (urgent) toasts.unshift(text);
  else toasts.push(text);
  if (!toastBusy) nextToast();
}
const toasts = [];
let toastBusy = false;
function nextToast() {
  const el = $("toast");
  const text = toasts.shift();
  if (!text) {
    toastBusy = false;
    el.hidden = true;
    return;
  }
  toastBusy = true;
  el.classList.toggle("low", screen !== "game");
  el.textContent = text;
  el.hidden = true;
  void el.offsetWidth;
  el.hidden = false;
  setTimeout(nextToast, 2300);
}

let bannerTimer = 0;
function showBanner(eyebrow, title, hint = "", alert = false) {
  const el = $("banner");
  $("banner-eyebrow").textContent = eyebrow;
  $("banner-title").textContent = title;
  $("banner-hint").textContent = hint;
  $("banner-hint").hidden = !hint;
  el.classList.toggle("alert", alert);
  el.hidden = true;
  void el.offsetWidth;
  el.hidden = false;
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => (el.hidden = true), 2200);
}

function vibrate(pattern) {
  if (profile.settings.vibration) buzz(pattern);
}

// ---------- partida ----------

function startRun() {
  audio.unlock();
  worldH = chooseWorldH();
  const firstRun = profile.stats.runs === 0;
  const announced = new Set();
  session = { game: null, announced, nextCheck: 0, tutorialT: 0, moved: 0 };
  demo = null;
  layout();
  const g = createGame({
    H: worldH,
    seed: (Math.random() * 2 ** 31) >>> 0,
    loadout: loadoutFor(profile),
    skill: profile.stats.skill,
    struggling: struggling(profile),
    firstRun,
    reducedMotion,
    onEvent: (type, data) => onGameEvent(session, type, data),
  });
  session.game = g;
  g.bottomInset = (parseFloat(getComputedStyle(probe).paddingBottom) || 0) / fit;
  hud.reset();
  setScreen("game");
  audio.music.play("voo");
  const info = sectorInfo(1);
  showBanner("Setor 1", info.name, firstRun ? "Pegue as cápsulas que caem." : "");
  if (!profile.tutorial) {
    const mouse = matchMedia("(pointer: fine)").matches;
    $("hint-text").innerHTML = mouse ? "Mova com o mouse ou as setas.<br>A nave atira sozinha." : "Arraste para mover.<br>A nave atira sozinha.";
    $("hint").hidden = false;
  }
  analytics.track("run_start", { ship: profile.ship, runs: profile.stats.runs });
}

function onGameEvent(s, type, d) {
  if (s !== session) return;
  const g = s.game;
  renderer.event(type, d, g);
  switch (type) {
    case "shot":
      audio.shot(d.level);
      break;
    case "rocket":
      audio.rocket();
      break;
    case "hit":
      audio.hit();
      break;
    case "kill":
      audio.kill(d.size);
      if (d.size >= 20) vibrate(18);
      break;
    case "explode":
      audio.explode();
      break;
    case "cap_spawn":
      audio.capSpawn();
      break;
    case "cap":
      audio.cap(d.type);
      if (d.rarity && d.rarity !== "comum") audio.rarity(d.rarity);
      if (d.type === "P") audio.pulse();
      vibrate(d.type === "P" ? [30, 20, 60] : d.rarity === "lendaria" ? [20, 30, 20, 30, 40] : 10);
      for (const w of Object.keys(d.gained ?? {})) hud.bumpWeapon(w);
      if (d.gained?.M) gunRecord(s);
      break;
    case "form":
      audio.form();
      vibrate([15, 25, 30]);
      break;
    case "cristal":
      audio.cristal(d.streak);
      break;
    case "graze":
      audio.graze();
      break;
    case "hurt":
      audio.hurt();
      vibrate([40, 30, 40]);
      hud.bumpHearts();
      break;
    case "shield_break":
      audio.shieldBreak();
      vibrate(25);
      break;
    case "shield_up":
      audio.shieldUp();
      break;
    case "turbo":
      audio.turbo(d.on);
      if (d.on) vibrate(15);
      break;
    case "combo":
      audio.combo(d.mult);
      hud.bumpMult();
      break;
    case "boss_warn":
      audio.bossWarn();
      vibrate([60, 60, 60]);
      showBanner("Alerta", d.name, "Chefe se aproximando", true);
      break;
    case "boss_start":
      audio.music.play("chefe");
      break;
    case "boss_phase":
      audio.bossPhase();
      vibrate(30);
      break;
    case "boss_kill":
      audio.bossKill();
      vibrate([50, 40, 80, 40, 120]);
      break;
    case "sector_clear":
      setTimeout(() => {
        if (s === session) showBanner(`Setor ${d.sector}`, "Setor limpo", d.noHit ? `Sem dano: +${fmt(d.bonus)}` : `Bônus +${fmt(d.bonus)}`);
      }, 1400);
      break;
    case "sector":
      audio.music.play("voo");
      audio.sector();
      showBanner(`Setor ${d.n}`, d.name, "Mais rápido. Mais forte.");
      break;
    case "deflect":
      audio.deflect();
      break;
    case "dead":
      audio.dead();
      vibrate([80, 50, 160]);
      break;
    case "over":
      finishRun(s, d);
      break;
    default:
  }
}

// Recorde de nível da metralhadora: aviso na hora, uma vez por partida
// (só para quem já tem um recorde guardado).
function gunRecord(s) {
  const best = profile.stats.best.gun;
  const level = s.game.player.gun;
  if (s.gunRecord || best <= 0 || level <= best) return;
  s.gunRecord = true;
  showToast(`Recorde: metralhadora nível ${level}`, true);
  audio.mission();
  vibrate(15);
}

// Missões cumpridas no meio da partida: aviso na hora.
function checkMissions(s) {
  const run = s.game.summary();
  for (const m of profile.missions) {
    if (s.announced.has(m.id) || !isDone(m, run)) continue;
    s.announced.add(m.id);
    showToast(`Missão cumprida: ${missionText(m)}`);
    audio.mission();
    vibrate(15);
  }
}

function finishRun(s, summary) {
  const before = profile;
  const result = applyRun(profile, summary, localDay(), rng);
  profile = result.profile;
  saveProfile(profile);
  sessionPlay += summary.dur;
  analytics.track("run_end", {
    score: summary.score,
    sector: summary.sector,
    dur: Math.round(summary.dur),
    kills: summary.kills,
    caps: summary.caps,
    cause: summary.cause,
    ship: summary.ship,
    skill: Math.round(profile.stats.skill * 100) / 100,
  });
  audio.music.play("menu");
  showResult(summary, result, before);
}

function showResult(run, result, before) {
  const firstRun = before.stats.runs === 0;
  const prevBest = result.previousBest.score;
  const record = result.records.score;
  const info = sectorInfo(run.sector);
  $("res-eyebrow").textContent = `Setor ${run.sector} · ${info.name}`;
  $("res-title").textContent = record ? "Novo recorde" : firstRun ? "Primeiro voo" : "Nave abatida";
  $("result").querySelector(".card").classList.toggle("record", record);
  $("res-best").textContent = firstRun ? "" : record ? `Antes: ${fmt(prevBest)}` : `Recorde ${fmt(prevBest)}`;

  // quase lá: a meta mais perto vira o motivo para jogar de novo
  let sub;
  const close = [...before.missions]
    .map((m) => ({ m, after: result.completed.find((c) => c.id === m.id) ?? result.profile.missions.find((c) => c.id === m.id) }))
    .filter((x) => x.after && x.after.progress < x.m.n)
    .sort((a, b) => b.after.progress / b.m.n - a.after.progress / a.m.n)[0];
  if (record) sub = `Você passou o recorde por ${fmt(run.score - prevBest)} pontos.`;
  else if (!firstRun && prevBest && run.score >= prevBest * 0.6) sub = `Faltaram ${fmt(prevBest - run.score)} pontos para o recorde.`;
  else if (close && close.after.progress / close.m.n >= 0.5) sub = `Quase lá: ${missionText(close.m).toLowerCase()} (${fmt(close.after.progress)} de ${fmt(close.m.n)}).`;
  else sub = `Derrubado ${causeBy(run.cause)}.`;
  $("res-sub").textContent = sub;

  const meter = $("res-meter");
  meter.hidden = record || firstRun || !prevBest;
  const bar = meter.firstElementChild;
  bar.style.width = "0";
  if (!meter.hidden) requestAnimationFrame(() => (bar.style.width = `${Math.min(100, Math.round((run.score / prevBest) * 100))}%`));

  const r = result.reward;
  const parts = [];
  if (r.daily) parts.push("×2 bônus do dia");
  if (r.rank) parts.push(`+${fmt(r.rank)} da patente`);
  if (r.missions) parts.push(`+${fmt(r.missions)} de missões`);
  $("res-cristais-detail").textContent = parts.join(" · ");

  // missões: as cumpridas (com brilho) e as que continuam
  const doneIds = new Set(result.completed.map((m) => m.id));
  const shown = before.missions.map((m) => result.completed.find((c) => c.id === m.id) ?? result.profile.missions.find((c) => c.id === m.id) ?? m);
  $("res-missions").innerHTML = shown.map((m) => missionItem(m, null, { compact: true, justDone: doneIds.has(m.id) })).join("");

  const extra = [];
  if (result.rankUp) extra.push(`Nova patente: ${result.rankUp.name}. Cristais +${Math.round(result.rankUp.bonus * 100)}% em toda partida.`);
  for (const id of result.newShips) extra.push(`Nave liberada: ${SHIPS[id].name}. Escolha no hangar.`);
  const n = affordableCount(profile);
  if (!extra.length && n) extra.push(`${n === 1 ? "Uma melhoria cabe" : `${n} melhorias cabem`} no seu bolso. Passe no hangar.`);
  if (!breakShown && sessionPlay >= BREAK_AFTER) {
    breakShown = true;
    extra.push(`Já são ${Math.round(BREAK_AFTER / 60)} minutos de voo. Uma pausa faz bem; seu progresso fica salvo.`);
  }
  $("res-extra").hidden = !extra.length;
  $("res-extra").textContent = extra.join(" ");
  $("res-hangar-badge").hidden = n === 0;

  countUp($("res-score"), run.score, 900);
  countUp($("res-cristais"), r.total, 900, true);
  resultShownAt = performance.now();
  setScreen("result");
  if (record) {
    audio.record();
    vibrate([10, 40, 10, 40, 20]);
  }
  if (result.completed.length) setTimeout(() => audio.mission(), 500);
}

function countUp(el, to, ms, ticks = false) {
  const start = performance.now();
  const step = (now) => {
    const u = Math.min(1, (now - start) / ms);
    const v = Math.round(to * (1 - (1 - u) ** 3));
    el.textContent = fmt(v);
    if (ticks && u < 1) audio.tick(Math.floor(u * 14));
    if (u < 1 && screen === "result") requestAnimationFrame(step);
    else el.textContent = fmt(to);
  };
  requestAnimationFrame(step);
}

function pause() {
  if (screen !== "game") return;
  const g = session.game;
  $("pause-eyebrow").textContent = `Setor ${g.sector} · ${sectorInfo(g.sector).name}`;
  const run = g.summary();
  $("pause-missions").innerHTML = profile.missions.map((m) => missionItem(m, run, { compact: true })).join("");
  setScreen("pause");
  audio.music.stop();
}

function resume() {
  if (screen !== "pause") return;
  setScreen("game");
  audio.music.play(session.game.boss ? "chefe" : "voo");
}

// ---------- HUD ----------

const hud = (() => {
  let last = {};
  const el = {
    hearts: $("hud-hearts"),
    weapons: $("hud-weapons"),
    next: $("hud-next"),
    score: $("hud-score"),
    mult: $("hud-mult"),
    cristais: $("hud-cristais"),
    sector: $("hud-sector").firstElementChild,
    sectorBar: $("hud-sector"),
    boss: $("hud-boss"),
    bossFill: $("hud-boss").querySelector(".fill"),
    bossName: $("hud-boss-name"),
    turbo: $("hud-turbo"),
    turboFill: $("hud-turbo").firstElementChild,
  };
  const bump = (node, cls = "bump") => {
    if (reducedMotion || !node) return;
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
  };
  return {
    reset() {
      last = {};
    },
    bumpHearts() {
      bump(el.hearts.lastElementChild);
    },
    bumpMult() {
      bump(el.mult);
    },
    bumpWeapon(type) {
      last.weapons = null;
      requestAnimationFrame(() => bump(el.weapons.querySelector(`[data-w="${type}"]`), "up"));
    },
    update(g) {
      const p = g.player;
      const hearts = `${p.hp}/${p.maxHp}/${p.shield}`;
      if (hearts !== last.hearts) {
        last.hearts = hearts;
        el.hearts.innerHTML =
          Array.from({ length: p.maxHp }, (_, i) => `<i class="${i < p.hp ? "" : "empty"}"></i>`).join("") + (p.shield ? '<i class="shield"></i>' : "");
        el.hearts.setAttribute("aria-label", `Casco ${p.hp} de ${p.maxHp}${p.shield ? ", com escudo" : ""}`);
      }
      const levels = { M: p.gun, F: p.rockets, D: p.drones };
      const weapons = `${p.gun}/${p.rockets}/${p.drones}`;
      if (weapons !== last.weapons) {
        last.weapons = weapons;
        last.colors = {};
        const items = [["M", p.gun]];
        if (p.rockets) items.push(["F", p.rockets]);
        if (p.drones) items.push(["D", p.drones]);
        el.weapons.innerHTML = items.map(([k, v]) => `<span data-w="${k}"><i style="--img:url(${iconUrl(`cap_${k}`)})"></i>${weaponLabel(v)}</span>`).join("");
        // próximo marco da metralhadora: forma nova até o 30, depois a próxima ★
        const next = nextMilestone(p.gun);
        const done = ((POWER.band - next.missing) / POWER.band) * 100;
        el.next.innerHTML = `${next.missing === 1 ? "falta" : "faltam"} ${next.missing} para ${next.label.toUpperCase()}<span class="next-bar"><span style="width:${done}%"></span></span>`;
      }
      // nível na cor da faixa de cada arma (o arco-íris muda com o tempo)
      for (const span of el.weapons.children) {
        const w = span.dataset.w;
        const color = rampOf(bandOf(levels[w]), g.t)[1];
        if (last.colors[w] === color) continue;
        last.colors[w] = color;
        span.style.color = color;
        if (w === "M") el.next.style.setProperty("--band", color);
      }
      const score = Math.round(g.score);
      if (score !== last.score) {
        last.score = score;
        el.score.textContent = fmt(score);
      }
      if (g.mult !== last.mult) {
        last.mult = g.mult;
        el.mult.hidden = g.mult < 2;
        el.mult.textContent = `×${g.mult}`;
      }
      if (g.crystals !== last.cristais) {
        last.cristais = g.crystals;
        el.cristais.textContent = fmt(g.crystals);
      }
      const boss = g.boss;
      if (Boolean(boss) !== last.bossOn) {
        last.bossOn = Boolean(boss);
        el.boss.hidden = !boss;
        el.sectorBar.hidden = Boolean(boss);
        if (boss) el.bossName.textContent = boss.name.toUpperCase();
      }
      if (boss) el.bossFill.style.width = `${Math.max(0, (boss.hp / boss.maxHp) * 100).toFixed(1)}%`;
      else el.sector.style.width = `${(g.progress() * 100).toFixed(1)}%`;
      el.turboFill.style.width = `${((g.turboMeter / TURBO.full) * 100).toFixed(1)}%`;
      const on = g.turboT > 0;
      if (on !== last.turbo) {
        last.turbo = on;
        el.turbo.classList.toggle("on", on);
      }
    },
  };
})();

// ---------- hangar, missões, ajustes ----------

function openOverlay(name) {
  overlayFrom = screen === "result" ? "result" : "home";
  if (name === "hangar") renderHangar();
  if (name === "missions") renderMissions();
  if (name === "settings") renderSettings();
  if (name === "collection") renderCollection();
  setScreen(name);
}

function closeOverlay() {
  if (overlayFrom === "result") {
    setScreen("result");
    resultShownAt = performance.now();
    $("res-hangar-badge").hidden = affordableCount(profile) === 0;
  } else setScreen("home");
}

let hangarTab = "melhorias";
function renderHangar() {
  $("hangar-cristais").textContent = fmt(profile.cristais);
  $("tab-melhorias").innerHTML = upgradesPanel(profile, iconUrl);
  $("tab-naves").innerHTML = shipsPanel(profile, iconUrl);
  $("tab-registro").innerHTML = statsPanel(profile);
  for (const tab of document.querySelectorAll(".tab")) {
    const on = tab.dataset.tab === hangarTab;
    tab.setAttribute("aria-selected", String(on));
    $(`tab-${tab.dataset.tab}`).hidden = !on;
  }
}

function renderCollection() {
  const data = collectionData(profile);
  const forms = [...data.forms.gun, ...data.forms.rockets, ...data.forms.drones];
  $("collection-count").textContent = `${data.bosses.filter((b) => b.seen).length} de ${data.bosses.length} chefes vistos · ${forms.filter((f) => f.unlocked).length} de ${forms.length} formas`;
  $("collection-list").innerHTML = collectionPanel(data, iconUrl);
}

function renderMissions() {
  const rank = rankOf(profile.missionsDone);
  $("rank-name").textContent = rank.name;
  const bar = $("rank-meter").firstElementChild;
  bar.style.width = "0";
  requestAnimationFrame(() => (bar.style.width = `${Math.round((rank.progress / 3) * 100)}%`));
  $("rank-sub").textContent = `${rank.progress} de 3 missões para a próxima patente. Cada patente dá +5% de cristais${rank.bonus ? ` (hoje: +${Math.round(rank.bonus * 100)}%)` : ""}.`;
  $("mission-list").innerHTML = profile.missions.map((m) => missionItem(m, null)).join("");
}

function renderSettings() {
  for (const t of document.querySelectorAll(".toggle")) t.setAttribute("aria-pressed", String(profile.settings[t.dataset.key]));
  document.querySelector('#settings .toggle[data-key="analytics"]').hidden = !analytics.available;
  $("btn-install").hidden = !installPrompt;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !native && !matchMedia("(display-mode: standalone)").matches;
  $("install-ios").hidden = !ios;
}

function applySettings() {
  audio.setSfx(profile.settings.sfx);
  audio.setMusic(profile.settings.music);
}

function toggleSetting(key) {
  const settings = { ...profile.settings, [key]: !profile.settings[key] };
  profile = { ...profile, settings };
  if (key === "analytics" && settings.analytics && !profile.id) profile = { ...profile, id: newInstallId() };
  saveProfile(profile);
  applySettings();
  for (const t of document.querySelectorAll(`.toggle[data-key="${key}"]`)) t.setAttribute("aria-pressed", String(settings[key]));
  audio.ui();
}

// ---------- tela inicial: piloto automático jogando ----------

function startDemo() {
  demo = createGame({
    H: worldH,
    mode: "demo",
    seed: (Math.random() * 2 ** 31) >>> 0,
    loadout: { ...loadoutFor(profile), gun: 3, rockets: 1, hp: 3, maxHp: 3 },
    skill: 0.5,
    onEvent: (type, data) => {
      if (demo) renderer.event(type, data, demo);
    },
  });
  bot = createBot({ skill: 0.85, seed: (Math.random() * 1e9) >>> 0 });
  fitDemo();
}

// A nave do fundo voa acima dos botões da tela inicial.
function fitDemo() {
  if (!demo || $("home").hidden) return;
  const box = frame.getBoundingClientRect();
  const buttons = $("home-bottom").getBoundingClientRect();
  if (buttons.height) demo.bottomInset = Math.max(0, (box.bottom - buttons.top + 16) / fit);
}

// ---------- entrada ----------

let pointer = null;
const keys = new Set();

function worldPoint(e) {
  const r = frame.getBoundingClientRect();
  return { x: (e.clientX - r.left) / fit, y: (e.clientY - r.top) / fit };
}

function act(fn) {
  audio.unlock();
  audio.ui();
  fn();
}

function playAgain() {
  if (performance.now() - resultShownAt < TAP_GUARD_MS) return;
  act(startRun);
}

frame.addEventListener("pointerdown", (e) => {
  audio.unlock();
  if (e.target.closest("button, a, .card")) return;
  if (screen === "game") {
    pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, type: e.pointerType };
    try {
      frame.setPointerCapture(e.pointerId);
    } catch {
      // ponteiro já solto
    }
    if (e.pointerType === "mouse") {
      const p = worldPoint(e);
      session.game.aimAt(p.x, p.y);
    }
  } else if (screen === "result") {
    playAgain();
  }
});

frame.addEventListener("pointermove", (e) => {
  if (screen !== "game") return;
  const g = session.game;
  if (e.pointerType === "mouse") {
    const p = worldPoint(e);
    g.aimAt(p.x, p.y);
    return;
  }
  if (!pointer || e.pointerId !== pointer.id) return;
  const events = e.getCoalescedEvents?.() ?? [e];
  const lastEv = events[events.length - 1] ?? e;
  const dx = ((lastEv.clientX - pointer.x) / fit) * TOUCH_SENS;
  const dy = ((lastEv.clientY - pointer.y) / fit) * TOUCH_SENS;
  pointer.x = lastEv.clientX;
  pointer.y = lastEv.clientY;
  g.nudge(dx, dy);
});

const release = (e) => {
  if (pointer && e.pointerId === pointer.id) pointer = null;
};
frame.addEventListener("pointerup", (e) => {
  release(e);
  audio.unlock();
});
frame.addEventListener("pointercancel", release);
frame.addEventListener("pointerleave", (e) => {
  if (e.pointerType === "mouse" && screen === "game") session.game.stopAim();
});

const AXES = {
  ArrowLeft: [-1, 0],
  KeyA: [-1, 0],
  ArrowRight: [1, 0],
  KeyD: [1, 0],
  ArrowUp: [0, -1],
  KeyW: [0, -1],
  ArrowDown: [0, 1],
  KeyS: [0, 1],
};

function applyAxis() {
  if (!session) return;
  let ax = 0;
  let ay = 0;
  for (const k of keys) {
    ax += AXES[k][0];
    ay += AXES[k][1];
  }
  if (ax || ay) session.game.stopAim();
  session.game.setAxis(Math.sign(ax), Math.sign(ay));
}

document.addEventListener("keydown", (e) => {
  if (AXES[e.code]) {
    e.preventDefault();
    keys.add(e.code);
    applyAxis();
    return;
  }
  if (e.repeat) return;
  const onButton = e.target.closest?.("button, a");
  if (e.code === "Space" || e.code === "Enter") {
    if (onButton) return;
    e.preventDefault();
    if (screen === "home") act(startRun);
    else if (screen === "result") playAgain();
    else if (screen === "pause") act(resume);
  } else if (e.code === "Escape" || e.code === "KeyP") {
    if (screen === "game") pause();
    else if (screen === "pause") act(resume);
    else if (PANELS.includes(screen)) closeOverlay();
  } else if (e.code === "KeyM") {
    toggleSetting("music");
  }
});

document.addEventListener("keyup", (e) => {
  if (!AXES[e.code]) return;
  keys.delete(e.code);
  applyAxis();
});

window.addEventListener("blur", () => {
  keys.clear();
  applyAxis();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pause();
    audio.suspend();
  }
});

$("btn-play").addEventListener("click", () => act(startRun));
$("btn-hangar").addEventListener("click", () => act(() => openOverlay("hangar")));
$("btn-missions").addEventListener("click", () => act(() => openOverlay("missions")));
$("btn-collection").addEventListener("click", () => act(() => openOverlay("collection")));
$("btn-collection-close").addEventListener("click", () => act(closeOverlay));
$("rank-chip").addEventListener("click", () => act(() => openOverlay("missions")));
$("btn-settings").addEventListener("click", () => act(() => openOverlay("settings")));
$("btn-hangar-close").addEventListener("click", () => act(closeOverlay));
$("btn-missions-close").addEventListener("click", () => act(closeOverlay));
$("btn-settings-close").addEventListener("click", () => act(closeOverlay));
$("btn-pause").addEventListener("click", () => act(pause));
$("btn-resume").addEventListener("click", () => act(resume));
$("btn-restart").addEventListener("click", () => act(startRun));
$("btn-pause-home").addEventListener("click", () => act(goHome));
$("res-again").addEventListener("click", playAgain);
$("res-hangar").addEventListener("click", () => act(() => openOverlay("hangar")));
$("res-home").addEventListener("click", () => act(goHome));

for (const t of document.querySelectorAll(".toggle")) t.addEventListener("click", () => toggleSetting(t.dataset.key));

for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    hangarTab = tab.dataset.tab;
    audio.ui();
    renderHangar();
  });
}

$("hangar").addEventListener("click", (e) => {
  const buy = e.target.closest("[data-buy]");
  if (buy && !buy.disabled) {
    const r = buyUpgrade(profile, buy.dataset.buy);
    if (r.ok) {
      profile = r.profile;
      saveProfile(profile);
      audio.buy();
      vibrate(12);
      analytics.track("upgrade", { key: buy.dataset.buy, level: profile.upgrades[buy.dataset.buy] });
      renderHangar();
      showToast(`${UPGRADES[buy.dataset.buy].name} nível ${profile.upgrades[buy.dataset.buy]}`);
    }
    return;
  }
  const ship = e.target.closest("[data-ship]");
  if (ship && !ship.disabled) {
    profile = { ...profile, ship: ship.dataset.ship };
    saveProfile(profile);
    audio.buy();
    renderHangar();
  }
});

$("btn-reset").addEventListener("click", () => {
  // eslint-disable-next-line no-alert
  if (!confirm("Apagar todo o progresso? Cristais, melhorias, naves e recordes voltam do zero.")) return;
  clearProfile();
  profile = ensureMissions(defaultProfile(), rng);
  saveProfile(profile);
  applySettings();
  renderSettings();
  showToast("Progresso apagado");
});

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installPrompt = e;
  if (screen === "settings") renderSettings();
});
$("btn-install").addEventListener("click", async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice.catch(() => null);
  installPrompt = null;
  renderSettings();
});

window.addEventListener("resize", layout);

if (native) {
  App.addListener("backButton", () => {
    if (screen === "game") pause();
    else if (screen === "pause") resume();
    else if (PANELS.includes(screen)) closeOverlay();
    else if (screen === "result") goHome();
    else App.exitApp();
  });
  App.addListener("pause", () => pause());
}

// ---------- laço ----------

let last = performance.now();
let musicT = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (session) {
    const g = session.game;
    if (screen === "game") {
      if (autopilot) autopilot.drive(g, dt);
      const px = g.player.x;
      const py = g.player.y;
      g.update(dt);
      // dica de controle some quando a nave anda (dedo, mouse ou teclado)
      session.moved += Math.hypot(g.player.x - px, g.player.y - py);
      session.nextCheck -= dt;
      if (session.nextCheck <= 0) {
        session.nextCheck = 0.5;
        checkMissions(session);
      }
      if (!$("hint").hidden) {
        session.tutorialT += dt;
        if (session.moved > 30 || session.tutorialT > 7) {
          $("hint").hidden = true;
          if (!profile.tutorial) {
            profile = { ...profile, tutorial: true };
            saveProfile(profile);
          }
        }
      }
      musicT -= dt;
      if (musicT <= 0) {
        musicT = 0.25;
        audio.music.setIntensity(g.boss ? 1 : g.phase === "waves" ? tension(g.sectorT) : 0.5, g.turboT > 0);
      }
    }
    renderer.draw(g, screen === "pause" ? 0 : dt);
    if (screen === "game" || screen === "pause") hud.update(g);
  } else if (demo) {
    bot.drive(demo, dt);
    demo.update(dt);
    if (demo.t > 75) startDemo();
    renderer.draw(demo, dt);
  }
  requestAnimationFrame(loop);
}

layout();
goHome();
requestAnimationFrame(loop);

// Só para os testes automáticos (tests/smoke.mjs): ?qa na URL.
if (qa) {
  window.__rajada = {
    screen: () => screen,
    game: () => session?.game ?? null,
    profile: () => profile,
    setProfile(p) {
      profile = ensureMissions(p, rng);
      saveProfile(profile);
      renderHome();
    },
    capsule(type, rarity = "comum") {
      const g = session?.game;
      if (g) g.items.push({ kind: "cap", type, rarity, x: g.player.x, y: g.player.y - 2, t: 0 });
    },
    fx: () => renderer.fxStats(),
    spriteMs: renderer.spriteMs,
    // põe a metralhadora (M), os foguetes (F) ou os drones (D) no nível n
    level(weapon, n) {
      const g = session?.game;
      if (g) g.player[{ M: "gun", F: "rockets", D: "drones" }[weapon]] = n;
    },
    skipToBoss() {
      const g = session?.game;
      if (g) g.sectorT = g.sectorLen;
    },
    autopilot(on, skill = 0.9) {
      autopilot = on ? createBot({ skill, seed: 7 }) : null;
    },
    wave(id) {
      session?.game.spawnWave(id);
    },
    jumpTo(sector, bossN) {
      session?.game.jumpTo(sector, bossN);
    },
    hurt() {
      const g = session?.game;
      if (!g) return;
      g.player.inv = 0;
      g.shots.push({ x: g.player.x, y: g.player.y, vx: 0, vy: 0, kind: "bala", r: 2, grazed: true, t: 0, src: "atirador" });
    },
  };
}

// Modo offline no site (PWA). O build liga isso; no app nativo e na prévia fica de fora.
if (typeof __PWA__ !== "undefined" && __PWA__ && "serviceWorker" in navigator && !native) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
