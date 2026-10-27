// Pedaços de interface montados em HTML: missões, hangar, naves, registro e coleção.
// Só gera marcação; quem decide quando mostrar é main.js.
import { UPGRADES, UPGRADE_ORDER, SHIPS, SHIP_ORDER, BOSSES, GUN_FORMS, ROCKET_MARKS, DRONE_MARKS } from "./config.js";
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
    // sem teto: depois da tabela, o nível aparece em número
    const pips = U.infinite && lv >= U.costs.length ? `<b class="lv">nv ${lv}</b>` : U.costs.map((_, i) => `<i class="${i < lv ? "on" : ""}"></i>`).join("");
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

// ---------- coleção ----------

// Chefes vistos e derrotados e as formas de cada arma, liberadas quando o
// recorde de nível da arma chega ao nível delas (a Rajada sempre aparece).
export function collectionData(profile) {
  const st = profile.stats;
  const marks = (table, level) => Object.entries(table).map(([at, name]) => ({ name, at: Number(at), unlocked: level >= Number(at) }));
  return {
    bosses: BOSSES.map((b) => ({ id: b.id, name: b.name, sprite: b.sprite, seen: !!st.bossSeen?.[b.id], kills: st.bossKills?.[b.id] ?? 0 })),
    forms: {
      gun: GUN_FORMS.map((f) => ({ name: f.name, at: f.at, unlocked: Math.max(1, st.best.gun ?? 0) >= f.at })),
      rockets: marks(ROCKET_MARKS, st.best.rockets ?? 0),
      drones: marks(DRONE_MARKS, st.best.drones ?? 0),
    },
  };
}

// Chefe nunca visto: silhueta e "???". Forma bloqueada: só o nível.
export function collectionPanel(data, iconUrl) {
  const bosses = data.bosses
    .map((b) => {
      const sub = !b.seen ? "Nunca visto" : b.kills ? `Derrotado ${b.kills}×` : "Ainda não derrotado";
      return `<li class="col-boss${b.seen ? "" : " unseen"}">
        <span class="pic" style="--img:url(${iconUrl(b.sprite)})" aria-hidden="true"></span>
        <b>${b.seen ? b.name : "???"}</b><small>${sub}</small>
      </li>`;
    })
    .join("");
  const forms = (title, list) => `<h3 class="col-title">${title}</h3>
    <ul class="col-forms">${list
      .map((f) => `<li class="${f.unlocked ? "on" : "off"}"><b>${f.unlocked ? f.name : `Nível ${f.at}`}</b>${f.unlocked ? `<small>Nível ${f.at}</small>` : ""}</li>`)
      .join("")}</ul>`;
  return `<h3 class="col-title">Chefes</h3><ul class="col-bosses">${bosses}</ul>
    ${forms("Metralhadora", data.forms.gun)}${forms("Foguetes", data.forms.rockets)}${forms("Drones", data.forms.drones)}`;
}
