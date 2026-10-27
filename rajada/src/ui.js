// Pedaços de interface montados em HTML: missões, hangar, naves e registro.
// Só gera marcação; quem decide quando mostrar é main.js.
import { UPGRADES, UPGRADE_ORDER, SHIPS, SHIP_ORDER } from "./config.js";
import { missionText, liveProgress } from "./missions.js";
import { upgradeCost, shipUnlockProgress } from "./progress.js";
import { favoriteWeapon } from "./stats.js";
import { fmt } from "./format.js";

export const $ = (id) => document.getElementById(id);
export { fmt };

const UPGRADE_ICON = { casco: "coracao", canhao: "cap_M", ima: "ima", escudo: "cap_E", sorte: "trevo", foguetes: "cap_F" };

// Ícones em pixel: data URLs dos próprios sprites, usados pelo CSS.
export function installIcons(sprites) {
  const cache = {};
  const url = (name, frame = 0) => {
    const key = `${name}:${frame}`;
    if (!cache[key]) cache[key] = sprites[name].frames[frame].toDataURL();
    return cache[key];
  };
  const root = document.documentElement.style;
  root.setProperty("--ico-cristal", `url(${url("cristal")})`);
  root.setProperty("--heart-full", `url(${url("coracao")})`);
  root.setProperty("--heart-empty", `url(${url("coracao_vazio")})`);
  return url;
}

export function missionItem(m, run, { compact = false, justDone = false, shownProgress } = {}) {
  const progress = shownProgress ?? (run ? liveProgress(m, run) : m.progress);
  const done = progress >= m.n;
  const pct = Math.min(100, (progress / m.n) * 100);
  return `<li class="mission${done ? " done" : ""}${justDone ? " just-done" : ""}" data-id="${m.id}">
    <span class="check" aria-hidden="true"></span>
    <p>${missionText(m)}${done ? '<span class="sr"> (cumprida)</span>' : ""}</p>
    <span class="reward">+${m.reward}<i class="ico ico-cristal" aria-label="cristais"></i></span>
    <div class="meter" aria-hidden="true"><span style="width:${pct}%"></span></div>
    ${compact ? "" : `<span class="count">${fmt(Math.min(progress, m.n))} de ${fmt(m.n)}</span>`}
  </li>`;
}

export function upgradesPanel(profile, iconUrl) {
  return UPGRADE_ORDER.map((key) => {
    const U = UPGRADES[key];
    const lv = profile.upgrades[key];
    const cost = upgradeCost(key, lv);
    const max = cost === null;
    const can = !max && profile.cristais >= cost;
    const pips = U.costs.map((_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
    const label = max
      ? `${U.name} no nível máximo`
      : `Comprar ${U.name} nível ${lv + 1} por ${fmt(cost)} cristais${can ? "" : `, faltam ${fmt(cost - profile.cristais)}`}`;
    const desc = max ? `${U.text(lv)}. Nível máximo.` : `Próximo: ${U.text(lv + 1).toLowerCase()}.${can ? "" : ` Faltam ${fmt(cost - profile.cristais)}.`}`;
    return `<div class="upgrade">
      <span class="pic" style="--img:url(${iconUrl(UPGRADE_ICON[key])})" aria-hidden="true"></span>
      <h3>${U.name}</h3>
      <button class="buy${max ? " max" : ""}" type="button" data-buy="${key}" aria-label="${label}"${max || !can ? " disabled" : ""}>
        ${max ? "MÁX" : `<span>${fmt(cost)} <i class="ico ico-cristal"></i></span>`}
      </button>
      <div class="pips" aria-hidden="true">${pips}</div>
      <p>${desc}</p>
    </div>`;
  }).join("");
}

export function shipsPanel(profile, iconUrl) {
  return SHIP_ORDER.map((id) => {
    const S = SHIPS[id];
    const owned = profile.ships.includes(id);
    const selected = profile.ship === id;
    const prog = shipUnlockProgress(id, profile);
    const status = selected ? "EM USO" : owned ? "USAR" : "BLOQ.";
    return `<div class="ship${owned ? "" : " locked"}">
      <span class="pic" style="--img:url(${iconUrl(S.sprite)})" aria-hidden="true"></span>
      <h3>${S.name}</h3>
      <button class="buy${selected ? " max" : ""}" type="button" data-ship="${id}"
        aria-label="${selected ? `${S.name} em uso` : owned ? `Usar a ${S.name}` : `${S.name} bloqueada`}"${!owned || selected ? " disabled" : ""}>${status}</button>
      <p>${owned ? S.perk : `${S.unlock.text}. ${S.perk}`}</p>
      ${owned ? "" : `<div class="meter" aria-hidden="true"><span style="width:${Math.round(prog * 100)}%"></span></div>`}
    </div>`;
  }).join("");
}

function duration(sec) {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

export function statsPanel(profile) {
  const s = profile.stats;
  const rows = [
    ["Partidas", fmt(s.runs)],
    ["Tempo de voo", duration(s.playTime)],
    ["Melhor pontuação", fmt(s.best.score)],
    ["Melhor setor", fmt(s.best.sector)],
    ["Inimigos destruídos", fmt(s.kills)],
    ["Chefes derrotados", fmt(s.bosses)],
    ["Maior combo", `×${s.best.combo}`],
    ["Cristais coletados", fmt(s.crystals)],
    ["Cápsulas", fmt(s.caps)],
    ["Raspões", fmt(s.grazes)],
    ["Arma favorita", favoriteWeapon(s)],
    ["Dias de voo", fmt(s.days)],
  ];
  return `<dl class="stats-grid">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}

// Nome amigável de quem derrubou a nave.
export function causeName(cause) {
  return (
    {
      zangao: "um Zangão",
      dardo: "um Dardo",
      atirador: "um Atirador",
      couracado: "um Couraçado",
      mina: "uma Mina",
      pedra_g: "uma pedra",
      pedra_m: "uma pedra",
      pedra_p: "uma pedra",
      portador: "um Portador",
      chefe: "um chefe",
      laser: "o laser do Olho",
    }[cause] ?? "tiro inimigo"
  );
}
