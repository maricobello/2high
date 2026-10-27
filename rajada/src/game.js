// Uma partida: estado e atualização em passo fixo. Não desenha nem toca som:
// avisa o que aconteceu por onEvent(tipo, dados) e o resto do app reage.
// Com a mesma semente e as mesmas entradas, a partida é sempre igual.
import {
  W,
  STEP,
  PLAYER,
  SHIPS,
  TURBO,
  COMBO,
  ENEMIES,
  SHOTS,
  DROPS,
  DIRECTOR,
  GUN,
  ROCKETS,
  DRONES,
  PERF,
  ELITE,
  eliteChance,
  BOSS_DROPS,
  SECTOR_BONUS,
  BOSSES,
  sectorLength,
  sectorScale,
  sectorInfo,
} from "./config.js";
import { createRng, clamp } from "./rng.js";
import { gunVolley, gunInterval, gunBeam, rocketSpec, rocketLaunch, steerRocket, pickTarget, droneSpec, droneVolley } from "./weapons.js";
import { killDropChance, pickCapsule, applyCapsule, weaponToLose, loseWeapon } from "./drops.js";
import { newPity, rollRarity, lootSource } from "./loot.js";
import { bandOf } from "./power.js";
import { skillAdjust, threatCap, pickWave, waveGap, isStrong } from "./director.js";
import { makeEnemy, moveEnemy, enemyFire, onEnemyDeath } from "./enemies.js";
import { buildWave, carrierEntry } from "./waves.js";
import { makeBoss, updateBoss, bossHit, bossBlocks, bossSprite } from "./bosses.js";

export const DEFAULT_LOADOUT = {
  ship: "faisca",
  hp: 3,
  gun: 1,
  rockets: 0,
  drones: 0,
  shield: false,
  shieldRegen: 0,
  magnet: 16,
  luck: 1,
  luckLevel: 0, // nível de Sorte do hangar: tira chance da cápsula comum
};

const DYING_FOR = 1.4;

// mode: "run" (partida valendo) ou "demo" (fundo da tela inicial, nave imortal).
export function createGame(opts = {}) {
  const {
    H = 400,
    seed = 1,
    loadout = DEFAULT_LOADOUT,
    skill = 0.3,
    struggling = false,
    firstRun = false,
    mode = "run",
    onEvent = () => {},
  } = opts;
  const rng = createRng(seed);
  const ship = SHIPS[loadout.ship] ?? SHIPS.faisca;
  const adjust = skillAdjust(skill, struggling);

  const p = {
    ship: ship === SHIPS[loadout.ship] ? loadout.ship : "faisca",
    def: ship,
    x: W / 2,
    y: H - 56,
    vx: 0,
    hp: loadout.hp,
    maxHp: loadout.hp,
    gun: loadout.gun,
    rockets: loadout.rockets,
    drones: loadout.drones,
    shield: loadout.shield,
    shieldRegen: loadout.shieldRegen,
    shieldT: 0,
    magnet: loadout.magnet,
    hitR: ship.hitR,
    speed: ship.speed,
    inv: 0,
    gunT: 0,
    volley: 0,
    beamT: 0,
    rocketT: 0.6,
    droneT: 0,
    dronePos: DRONES.offset.map(([dx, dy]) => ({ x: W / 2 + dx, y: H - 56 + dy })),
  };

  const g = {
    W,
    H,
    mode,
    rng,
    adjust,
    firstRun,
    t: 0,
    acc: 0,
    status: "playing", // playing → dying → over
    endT: 0,
    sector: 1,
    sectorT: 0,
    sectorLen: sectorLength(1, firstRun),
    scale: sectorScale(1),
    phase: "waves", // waves → clear → warn → boss → after → (próximo setor)
    phaseT: 0,
    score: 0,
    chain: 0,
    chainT: 0,
    mult: 1,
    turboMeter: 0,
    turboT: 0,
    crystals: 0,
    crystalStreak: 0,
    crystalT: 0,
    player: p,
    enemies: [],
    shots: [],
    bullets: [],
    rockets: [],
    beam: null, // Raio da metralhadora: { x, width, band }
    droneBeams: [], // raios dos drones: [{ x, y, len }]
    items: [],
    lasers: [],
    queue: [],
    boss: null,
    bossN: 0,
    waveT: firstRun ? 3 : 1.6, // primeira partida: 3 s de calma antes da primeira onda
    lastWave: null,
    mercy: 0,
    sinceCap: 0,
    sinceHit: 0,
    lastCarrier: -99,
    recover: null,
    capCool: { H: 0, E: 0 },
    pity: newPity(), // garantias de raridade (comuns seguidas, chefes sem lendária)
    magnetAll: false,
    sectorDamage: 0,
    hitstop: 0,
    bottomInset: 0,
    input: { mode: null, tx: 0, ty: 0, ax: 0, ay: 0, dx: 0, dy: 0 },
    script: firstRun
      ? [
          { at: 4, kind: "carrier", cap: "M" },
          { at: 17, kind: "carrier", cap: "F" },
          { at: 29, kind: "heavy", cap: "D" },
        ]
      : [],
    stats: {
      kills: 0,
      killsBy: { gun: 0, rockets: 0, drones: 0, pulse: 0, crash: 0 },
      killsType: {},
      caps: 0,
      capsBy: {},
      grazes: 0,
      turbos: 0,
      bosses: 0,
      noHitBoss: false,
      maxCombo: 1,
      carriers: 0,
      damage: 0,
      cause: null,
      maxGun: p.gun,
      maxRockets: p.rockets,
      s1Spawns: 0, // inimigos nascidos no setor 1
      s1Time: 0, // s de ondas no setor 1
    },
  };

  const emit = (type, data = {}) => onEvent(type, data);

  // ---------- entrada ----------

  g.nudge = (dx, dy) => {
    g.input.dx += dx;
    g.input.dy += dy;
  };
  g.aimAt = (x, y) => {
    g.input.mode = "target";
    g.input.tx = x;
    g.input.ty = y;
  };
  g.stopAim = () => {
    g.input.mode = null;
  };
  g.setAxis = (ax, ay) => {
    g.input.ax = ax;
    g.input.ay = ay;
  };

  // ---------- utilidades para inimigos e chefes ----------

  g.fire = (x, y, angle, speed, kind, extra) => {
    if (g.shots.length >= PERF.shots) return; // teto de desempenho: o tiro novo não sai
    const sp = speed * g.scale.shotSpeed * adjust.shotSpeed;
    g.shots.push({ x, y, vx: Math.cos(angle) * sp, vy: Math.sin(angle) * sp, kind, r: SHOTS[kind].r, grazed: false, t: 0, src: "chefe", ...extra });
  };
  g.aimAngle = (x, y) => Math.atan2(p.y - y, p.x - x);
  // Para os chefes: solta um inimigo na hora (respeita o teto de inimigos).
  g.spawnEnemy = (type, params) => {
    if (g.enemies.length >= PERF.enemies) return null;
    const e = makeEnemy(type, params, g.scale.hp);
    g.enemies.push(e);
    return e;
  };
  g.laser = (b, from, to, warn, fire, width = 7) => {
    g.lasers.push({ boss: b, x: b.x, y: b.y + 2, from, to, angle: from, t: 0, warn, fire, width });
  };
  g.fireRate = () => g.scale.fire * (g.mercy > 0 ? 0.6 : 1);
  g.progress = () => (g.phase === "waves" ? Math.min(1, g.sectorT / g.sectorLen) : 1);
  g.nextBoss = () => BOSSES[g.bossN % BOSSES.length];
  g.turboOn = () => g.turboT > 0;
  // Para testes e capturas das lojas: solta uma onda na hora e pula de setor.
  g.spawnWave = (id) => enqueue(buildWave(id, rng, W, H, g.sector));
  g.jumpTo = (sector, bossN = g.bossN) => {
    g.sector = sector;
    g.scale = sectorScale(sector);
    g.sectorLen = sectorLength(sector);
    g.bossN = bossN;
  };

  g.update = (dt) => {
    if (g.status === "over") return;
    if (g.hitstop > 0) {
      g.hitstop -= dt;
      return;
    }
    g.acc += Math.min(dt, 0.1);
    while (g.acc >= STEP) {
      g.acc -= STEP;
      step(STEP);
      if (g.status === "over") break;
    }
  };

  // ---------- passo ----------

  function step(dt) {
    g.t += dt;
    if (g.status === "dying") {
      g.endT += dt;
      moveWorld(dt);
      if (g.endT >= DYING_FOR) {
        g.status = "over";
        emit("over", summary());
      }
      return;
    }
    movePlayer(dt);
    firePlayer(dt);
    runDirector(dt);
    moveWorld(dt);
    collide();
    timers(dt);
    phases(dt);
    cleanup();
  }

  function movePlayer(dt) {
    const inp = g.input;
    const x0 = p.x;
    if (inp.dx || inp.dy) {
      p.x += inp.dx;
      p.y += inp.dy;
      inp.dx = 0;
      inp.dy = 0;
    }
    if (inp.ax || inp.ay) {
      const len = Math.hypot(inp.ax, inp.ay) || 1;
      const sp = PLAYER.keySpeed * p.speed * dt;
      p.x += (inp.ax / len) * sp;
      p.y += (inp.ay / len) * sp;
    }
    if (inp.mode === "target") {
      const dx = inp.tx - p.x;
      const dy = inp.ty - p.y;
      const d = Math.hypot(dx, dy);
      const maxStep = PLAYER.followSpeed * p.speed * dt;
      if (d > 0.01) {
        const k = Math.min(1, maxStep / d);
        p.x += dx * k;
        p.y += dy * k;
      }
    }
    p.x = clamp(p.x, 7, W - 7);
    p.y = clamp(p.y, H * PLAYER.topLimit, H - PLAYER.bottomMargin - g.bottomInset);
    p.vx += ((p.x - x0) / dt - p.vx) * Math.min(1, dt * 14);
    for (let i = 0; i < p.drones && i < p.dronePos.length; i++) {
      const d = p.dronePos[i];
      const [ox, oy] = DRONES.offset[i];
      d.x += (p.x + ox - d.x) * Math.min(1, dt * 10);
      d.y += (p.y + oy - d.y) * Math.min(1, dt * 10);
    }
  }

  function firePlayer(dt) {
    const turbo = g.turboT > 0;
    const fire = turbo ? TURBO.fireMult : 1;
    p.gunT -= dt;
    if (p.gunT <= 0) {
      p.gunT += gunInterval(p.gun, turbo);
      for (const b of gunVolley(p.gun, p.x, p.y - 7, p.volley++)) addBullet(b);
      emit("shot", { level: p.gun });
    }
    // Raio: o cano do meio vira um feixe que atravessa tudo na coluna da nave
    const beam = gunBeam(p.gun);
    g.beam = beam && { x: p.x, width: beam.width, band: beam.band };
    if (beam) {
      p.beamT -= dt;
      if (p.beamT <= 0) {
        p.beamT += beam.tick * fire;
        beamHit(p.x, p.y - 7, p.y + 13, beam.width, beam.dmg, "gun");
      }
    }
    const spec = rocketSpec(p.rockets, turbo);
    if (spec) {
      p.rocketT -= dt;
      if (p.rocketT <= 0) {
        p.rocketT += spec.every;
        for (const r of rocketLaunch(p.rockets, p.x, p.y)) g.rockets.push(r);
        emit("rocket", {});
      }
    }
    const drones = droneSpec(p.drones);
    g.droneBeams.length = 0;
    if (drones.count > 0) {
      if (drones.beam) for (let i = 0; i < drones.count; i++) g.droneBeams.push({ x: p.dronePos[i].x, y: p.dronePos[i].y - 4, len: DRONES.beam.len });
      p.droneT -= dt;
      if (p.droneT <= 0) {
        if (drones.beam) {
          p.droneT += DRONES.beam.tick * fire;
          for (const b of g.droneBeams) beamHit(b.x, b.y, b.len, 2, DRONES.beam.mult * drones.dmg, "drones");
        } else {
          p.droneT += drones.every * fire;
          for (let i = 0; i < drones.count; i++) {
            const d = p.dronePos[i];
            for (const b of droneVolley(p.drones, d.x, d.y - 4)) addBullet(b);
          }
        }
      }
    }
  }

  function addBullet(b) {
    if (!b.hits) b.hits = [];
    g.bullets.push(b);
  }

  // Dano de um feixe vertical de (x, y) até len acima, com a largura dada.
  // Quem está no feixe é decidido antes do dano: pedaços de pedra que nascem
  // agora não levam o mesmo tique.
  function beamHit(x, y, len, width, dmg, by) {
    const inBeam = (cx, cy, bw, bh) => Math.abs(cx - x) <= bw / 2 + width / 2 && cy - bh / 2 <= y && cy + bh / 2 >= y - len;
    const hit = g.enemies.filter((e) => !e.dead && !e.gone && e.y > -e.h / 2 && inBeam(e.x, e.y, e.def.box[0], e.def.box[1]));
    for (const e of hit) damageEnemy(e, dmg, by);
    const b = g.boss;
    if (b && !b.entering && b.vulnerable && b.hp > 0 && inBeam(b.x, b.y, b.box[0], b.box[1])) damageBoss(dmg);
  }

  // Curva o objeto (vx, vy) na direção de (tx, ty), no máximo maxTurn rad, sem mudar a velocidade.
  function turnToward(o, tx, ty, maxTurn) {
    const sp = Math.hypot(o.vx, o.vy);
    const cur = Math.atan2(o.vy, o.vx);
    let diff = Math.atan2(ty - o.y, tx - o.x) - cur;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const a = cur + clamp(diff, -maxTurn, maxTurn);
    o.vx = Math.cos(a) * sp;
    o.vy = Math.sin(a) * sp;
  }

  // Tiro teleguiado: escolhe o alvo a cada 0,25 s, com o mesmo critério dos foguetes.
  function steerBullet(b, dt) {
    b.seek = (b.seek ?? 0) - dt;
    const t = b.target;
    if (b.seek <= 0 || !t || t.hp <= 0 || t.dead || t.gone) {
      b.target = pickTarget(b, g.enemies, g.boss);
      b.seek = GUN.homingRetarget;
    }
    if (b.target) turnToward(b, b.target.x, b.target.y, GUN.homingTurn * dt);
  }

  function aliveThreat() {
    let sum = 0;
    for (const e of g.enemies) sum += e.def.threat;
    for (const q of g.queue) sum += ENEMIES[q.type].threat;
    return sum;
  }

  function enqueue(entries, cap) {
    for (const en of entries) g.queue.push({ ...en, at: g.t + en.at, cap: en.cap ?? cap });
  }

  function runDirector(dt) {
    // roteiro da primeira partida: cápsulas garantidas para ensinar
    while (g.script.length && g.script[0].at <= g.t) {
      const s = g.script.shift();
      if (s.kind === "carrier") enqueue([carrierEntry(rng, W, true)], s.cap);
      else enqueue(buildWave("couracado", rng, W, H, g.sector).map((en) => (en.type === "couracado" ? { ...en, cap: s.cap } : en)));
    }

    if (g.phase === "waves") {
      if (g.sector === 1) g.stats.s1Time += dt;
      g.waveT -= dt;
      if (g.waveT <= 0 && g.mercy <= 0) {
        const cap = threatCap({
          sector: g.sector,
          t: g.sectorT,
          adjust,
          hp: p.hp,
          sinceHit: g.sinceHit,
          strong: isStrong(p, g.sector),
        });
        const id = pickWave(rng, { sector: g.sector, t: g.sectorT, room: cap - aliveThreat(), last: g.lastWave });
        if (id) {
          enqueue(buildWave(id, rng, W, H, g.sector));
          g.lastWave = id;
          g.waveT = waveGap(rng, g.sector, g.sectorT);
        } else {
          g.waveT = 0.4;
        }
      }
      const carrierAlive = g.enemies.some((e) => e.type === "portador") || g.queue.some((q) => q.type === "portador");
      const scriptBusy = g.firstRun && g.t < 35;
      const carrierAfter = (DROPS.carrierAfter * (1 + DROPS.perSector * (g.sector - 1))) / loadout.luck;
      if (!carrierAlive && !scriptBusy && g.sinceCap > carrierAfter && g.t - g.lastCarrier > 8) {
        enqueue([carrierEntry(rng, W)]);
        g.lastCarrier = g.t;
      }
    }

    for (const q of g.queue) {
      if (q.at > g.t) continue;
      if (g.enemies.length >= PERF.enemies) break; // teto: o resto espera na fila
      // elites: a partir do setor 4 (nunca o Portador nem os do roteiro)
      const elite = g.sector >= ELITE.from && q.type !== "portador" && !q.cap && rng.chance(eliteChance(g.sector));
      const e = makeEnemy(q.type, q.params, g.scale.hp, elite);
      if (q.cap) e.cap = q.cap;
      g.enemies.push(e);
      if (g.sector === 1) g.stats.s1Spawns += 1;
      q.done = true;
    }
    if (g.queue.length) compact(g.queue, (q) => !q.done);
  }

  function moveWorld(dt) {
    for (const b of g.bullets) {
      if (b.homing) steerBullet(b, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life !== undefined) {
        b.life -= dt;
        if (b.life <= 0) b.dead = true;
      }
    }
    for (const r of g.rockets) {
      const t = r.target;
      if (!t || t.hp <= 0 || t.dead || t.gone) r.target = pickTarget(r, g.enemies, g.boss);
      steerRocket(r, r.target, dt);
    }
    for (const e of g.enemies) {
      if (!moveEnemy(e, dt, g)) {
        e.gone = true;
        continue;
      }
      if (e.spin) e.rot = (e.rot ?? 0) + e.spin * dt;
      if (g.status === "playing") enemyFire(e, dt, g);
    }
    if (g.boss && g.status === "playing") {
      const ev = updateBoss(g.boss, dt, g);
      if (ev === "phase2") emit("boss_phase", { name: g.boss.name });
    }
    for (const s of g.shots) {
      s.t += dt;
      if (s.home > 0) {
        s.home -= dt;
        turnToward(s, p.x, p.y, 2.2 * dt);
      }
      s.x += s.vx * dt;
      s.y += s.vy * dt;
    }
    for (const l of g.lasers) {
      l.t += dt;
      l.x = l.boss.x;
      l.y = l.boss.y + 2;
      const u = clamp((l.t - l.warn) / l.fire, 0, 1);
      l.angle = l.from + (l.to - l.from) * u;
    }
    for (const it of g.items) moveItem(it, dt);
  }

  function moveItem(it, dt) {
    it.t += dt;
    if (it.kind === "cap") {
      it.y += 44 * dt;
      it.x += Math.sin(it.t * 2.6) * 10 * dt;
      // perto da nave, a cápsula é puxada (perdoa quase-pegadas)
      const cdx = p.x - it.x;
      const cdy = p.y - it.y;
      if (g.status === "playing" && cdx * cdx + cdy * cdy < 22 * 22) {
        it.x += cdx * Math.min(1, dt * 6);
        it.y += cdy * Math.min(1, dt * 6);
      }
      return;
    }
    const dx = p.x - it.x;
    const dy = p.y - it.y;
    const d = Math.hypot(dx, dy);
    if (g.status === "playing" && (g.magnetAll || d < p.magnet)) {
      const sp = g.magnetAll ? 260 : 220;
      it.vx = (dx / (d || 1)) * sp;
      it.vy = (dy / (d || 1)) * sp;
    } else {
      it.vx *= 1 - Math.min(1, dt * 2);
      it.vy = Math.min(45, it.vy + 80 * dt);
    }
    it.x += it.vx * dt;
    it.y += it.vy * dt;
  }

  // ---------- colisões ----------

  function collide() {
    const b0 = g.boss;
    for (const b of g.bullets) {
      if (b.dead) continue;
      for (const e of g.enemies) {
        if (e.dead || e.gone || e.y < -e.h / 2 || b.hits.includes(e)) continue;
        if (Math.abs(b.x - e.x) <= e.def.box[0] / 2 + 1 && Math.abs(b.y - e.y) <= e.def.box[1] / 2 + 3) {
          damageEnemy(e, b.dmg, b.drone ? "drones" : b.shard ? "rockets" : "gun");
          // perfurante: atravessa `pierce` inimigos e para no seguinte
          if (b.hits.length < (b.pierce ?? 0)) {
            b.hits.push(e);
            continue;
          }
          b.dead = true;
          break;
        }
      }
      if (b.dead || !b0 || b0.entering) continue;
      if (bossHit(b0, b.x, b.y)) {
        b.dead = true;
        if (b0.vulnerable) damageBoss(b.dmg);
        else emit("deflect", { x: b.x, y: b.y });
      } else if (bossBlocks(b0, b.x, b.y)) {
        // gomo da Serpente: bloqueia o tiro, só a cabeça leva dano
        b.dead = true;
        emit("deflect", { x: b.x, y: b.y });
      }
    }

    for (const r of g.rockets) {
      if (r.dead) continue;
      let hit = null;
      for (const e of g.enemies) {
        if (e.dead || e.gone) continue;
        if (Math.abs(r.x - e.x) <= e.def.box[0] / 2 + 2 && Math.abs(r.y - e.y) <= e.def.box[1] / 2 + 2) {
          hit = e;
          break;
        }
      }
      const onBoss = !hit && g.boss && !g.boss.entering && bossHit(g.boss, r.x, r.y);
      const onBody = !hit && !onBoss && g.boss && !g.boss.entering && bossBlocks(g.boss, r.x, r.y);
      if (!hit && !onBoss && !onBody) continue;
      r.dead = true;
      // área da explosão decidida antes do impacto: pedaços de pedra que nascem
      // agora não levam o mesmo estouro
      const splash = g.enemies.filter((e) => e !== hit && !e.dead && !e.gone && Math.hypot(e.x - r.x, e.y - r.y) <= r.splash);
      if (hit) damageEnemy(hit, r.dmg, "rockets");
      if (onBoss && g.boss.vulnerable) damageBoss(r.dmg);
      for (const e of splash) damageEnemy(e, r.splashDmg, "rockets");
      // fragmentação: estilhaços em X, que não voltam em quem levou o foguete
      for (let k = 0; k < r.frag; k++) {
        const a = Math.PI / 4 + (k * Math.PI * 2) / r.frag;
        addBullet({
          x: r.x,
          y: r.y,
          vx: Math.cos(a) * ROCKETS.shardSpeed,
          vy: Math.sin(a) * ROCKETS.shardSpeed,
          dmg: r.splashDmg,
          big: false,
          pierce: 0,
          homing: false,
          band: r.band,
          life: ROCKETS.shardLife,
          shard: true,
          hits: hit ? [hit] : [],
        });
      }
      emit("explode", { x: r.x, y: r.y, size: 1 });
    }

    if (g.status !== "playing") return;

    for (const s of g.shots) {
      if (s.dead) continue;
      const dx = s.x - p.x;
      const dy = s.y - p.y;
      const d2 = dx * dx + dy * dy;
      const hr = s.r + p.hitR;
      if (d2 < hr * hr && p.inv <= 0) {
        s.dead = true;
        hurt(s.src);
        if (g.status !== "playing") return;
        continue;
      }
      if (!s.grazed) {
        const gr = s.r + PLAYER.grazeR;
        if (d2 < gr * gr) {
          s.grazed = true;
          g.stats.grazes += 1;
          g.score += 10 * g.mult;
          addTurbo(TURBO.perGraze);
          emit("graze", { x: s.x, y: s.y });
        }
      }
    }

    if (p.inv <= 0) {
      for (const e of g.enemies) {
        if (e.dead || e.gone) continue;
        if (Math.abs(e.x - p.x) < e.def.box[0] / 2 + 2 && Math.abs(e.y - p.y) < e.def.box[1] / 2 + 2) {
          hurt(e.type);
          damageEnemy(e, 10, "crash");
          break;
        }
      }
    }
    if (g.status !== "playing") return;
    if (p.inv <= 0 && g.boss && !g.boss.entering && (bossHit(g.boss, p.x, p.y, -4) || bossBlocks(g.boss, p.x, p.y, -3))) hurt("chefe");
    if (g.status !== "playing") return;

    for (const l of g.lasers) {
      if (l.t < l.warn || l.t > l.warn + l.fire || p.inv > 0) continue;
      const dx = p.x - l.x;
      const dy = p.y - l.y;
      const along = dx * Math.cos(l.angle) + dy * Math.sin(l.angle);
      const across = Math.abs(-dx * Math.sin(l.angle) + dy * Math.cos(l.angle));
      if (along > 0 && across < l.width / 2 + p.hitR) {
        hurt("laser");
        break;
      }
    }
    if (g.status !== "playing") return;

    for (const it of g.items) {
      if (it.dead) continue;
      const d = Math.hypot(it.x - p.x, it.y - p.y);
      if (it.kind === "cap" && d < 11) {
        it.dead = true;
        collectCapsule(it);
      } else if (it.kind === "cristal" && d < 7) {
        it.dead = true;
        g.crystals += 1;
        g.crystalStreak = g.crystalT > 0 ? g.crystalStreak + 1 : 0;
        g.crystalT = 0.6;
        emit("cristal", { streak: g.crystalStreak, x: it.x, y: it.y });
      }
    }
  }

  // ---------- dano, abates, cápsulas ----------

  function damageEnemy(e, dmg, by) {
    if (e.dead) return;
    e.hp -= dmg;
    // aviso de acerto: pequenos piscam branco; grandes, no máximo 3 vezes por
    // segundo (área grande piscando rápido é risco para fotossensíveis)
    if (!(e.flashCool > 0)) {
      e.flash = 0.06;
      e.flashCool = e.w >= 20 ? 0.34 : 0.12;
    }
    if (e.hp <= 0) killEnemy(e, by);
    else emit("hit", { x: e.x, y: e.y });
  }

  function killEnemy(e, by) {
    e.dead = true;
    e.hp = 0;
    const st = g.stats;
    st.kills += 1;
    st.killsBy[by] = (st.killsBy[by] ?? 0) + 1;
    st.killsType[e.type] = (st.killsType[e.type] ?? 0) + 1;
    if (e.type === "portador") st.carriers += 1;

    g.chain += 1;
    g.chainT = COMBO.window;
    const mult = Math.min(COMBO.max, 1 + Math.floor(g.chain / COMBO.perStep));
    if (mult > g.mult) emit("combo", { mult });
    g.mult = mult;
    st.maxCombo = Math.max(st.maxCombo, mult);

    const pts = e.def.score * g.mult * (g.turboT > 0 ? TURBO.scoreMult : 1);
    g.score += pts;
    addTurbo(e.def.turbo);

    const [chance, min, max] = e.def.cristal;
    if (rng.chance(chance)) spawnCrystals(e.x, e.y, rng.int(min, max) * (e.elite ? ELITE.crystals : 1));
    const source = lootSource(e);
    if (e.def.cap || e.cap) dropCapsule(e.x, e.y, e.cap, source);
    else if (rng.chance(killDropChance(g.sinceCap, loadout.luck, g.t < 60 ? adjust.earlyDrops : 1) / (1 + DROPS.perSector * (g.sector - 1)))) {
      dropCapsule(e.x, e.y, undefined, source);
    }

    if (e.def.split && g.enemies.length < PERF.enemies - 1) {
      for (const side of [-1, 1]) {
        g.enemies.push(
          makeEnemy(
            e.def.split,
            { x: e.x + side * 3, y: e.y, vx: side * rng.range(18, 34) + (e.vx ?? 0) * 0.5, vy: Math.max(24, e.vy * 0.9), spin: side * 4 },
            g.scale.hp,
          ),
        );
      }
    }
    onEnemyDeath(e, g);
    emit("kill", { x: e.x, y: e.y, type: e.type, size: Math.max(e.w, e.h), score: pts, mult: g.mult, by });
  }

  function damageBoss(dmg) {
    const b = g.boss;
    if (!b || b.hp <= 0) return;
    b.hp -= dmg;
    if (!(b.flashCool > 0)) {
      b.flash = 0.08;
      b.flashCool = 0.34;
    }
    if (b.hp <= 0) bossDefeated();
  }

  function bossDefeated() {
    const b = g.boss;
    const st = g.stats;
    st.bosses += 1;
    if (!b.damageTaken) st.noHitBoss = true;
    const pts = b.def.score * g.mult;
    g.score += pts;
    clearShots(false);
    g.lasers.length = 0;
    spawnCrystals(b.x, b.y, BOSS_DROPS.cristais);
    for (let i = 0; i < BOSS_DROPS.caps; i++) dropCapsule(b.x + (i ? 16 : -16), b.y + 10, undefined, i ? "chefe2" : "chefe1");
    const noHit = g.sectorDamage === 0;
    const bonus = SECTOR_BONUS.perSector * g.sector + (noHit ? SECTOR_BONUS.noHit : 0);
    g.score += bonus;
    g.magnetAll = true;
    g.boss = null;
    g.bossN += 1;
    g.phase = "after";
    g.phaseT = 0;
    g.hitstop = 0.2;
    emit("boss_kill", { name: b.name, sprite: bossSprite(b), x: b.x, y: b.y, w: b.w, h: b.h, score: pts, segments: b.segments?.map((s) => ({ ...s })) });
    emit("sector_clear", { sector: g.sector, bonus, noHit });
  }

  function spawnCrystals(x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, Math.PI * 2);
      const s = rng.range(20, 60 + n * 2);
      g.items.push({ kind: "cristal", x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, t: rng.range(0, 1) });
    }
  }

  function stress() {
    let near = 0;
    for (const s of g.shots) if (Math.abs(s.x - p.x) < 60 && Math.abs(s.y - p.y) < 80) near += 1;
    return clamp((near / 25) * (p.hp <= 1 ? 1.5 : 1), 0, 1);
  }

  // forced: tipo do roteiro da primeira partida (sempre comum, para ensinar).
  // source: origem que decide a chance de cada raridade (LOOT.sources).
  function dropCapsule(x, y, forced, source = "inimigo") {
    const type = forced ?? pickCapsule(rng, p, { t: g.t, recover: g.recover, stress: stress(), cool: g.capCool });
    const rarity = forced ? "comum" : rollRarity(rng, source, g.pity, loadout.luckLevel ?? 0);
    if (type === "H") g.capCool.H = g.t + DROPS.coolH;
    if (type === "E") g.capCool.E = g.t + DROPS.coolE;
    g.items.push({ kind: "cap", type, rarity, x: clamp(x, 10, W - 10), y, t: 0 });
    g.sinceCap = 0;
    emit("cap_spawn", { type, rarity, x, y });
  }

  function collectCapsule(it) {
    const st = g.stats;
    st.caps += 1;
    st.capsBy[it.type] = (st.capsBy[it.type] ?? 0) + 1;
    if (it.type === "P") pulse();
    const rarity = it.rarity ?? "comum";
    const r = applyCapsule(p, it.type, rarity);
    if (r.turbo) addTurbo(r.turbo === "cheio" ? TURBO.full : r.turbo);
    st.maxGun = Math.max(st.maxGun, p.gun);
    st.maxRockets = Math.max(st.maxRockets, p.rockets);
    emit("cap", { type: it.type, rarity, gained: r.gained, level: r.level, form: r.form, x: it.x, y: it.y });
    if (r.form) {
      const level = { M: p.gun, F: p.rockets, D: p.drones }[r.formWeapon];
      emit("form", { weapon: r.formWeapon, name: r.form, band: bandOf(level) });
    }
  }

  function clearShots(asScore) {
    const n = g.shots.length;
    if (asScore) g.score += n * 5;
    emit("clear_shots", { points: g.shots.map((s) => [s.x, s.y]) });
    g.shots.length = 0;
    return n;
  }

  function pulse() {
    const n = clearShots(true);
    g.lasers.length = 0;
    for (const e of g.enemies) if (!e.dead && e.y > -e.h / 2) damageEnemy(e, 30, "pulse");
    if (g.boss && g.boss.vulnerable) damageBoss(40);
    g.hitstop = 0.08;
    emit("pulse", { x: p.x, y: p.y, cleared: n });
  }

  function addTurbo(v) {
    if (g.turboT > 0 || g.status !== "playing") return;
    g.turboMeter = Math.min(TURBO.full, g.turboMeter + v);
    if (g.turboMeter >= TURBO.full) {
      g.turboT = TURBO.dur;
      g.stats.turbos += 1;
      emit("turbo", { on: true });
    }
  }

  function hurt(cause) {
    if (p.inv > 0 || g.status !== "playing") return;
    if (g.mode === "demo") {
      p.inv = PLAYER.invuln;
      return;
    }
    if (p.shield) {
      p.shield = false;
      p.shieldT = 0;
      p.inv = PLAYER.shieldInvuln;
      clearShotsNear(28);
      emit("shield_break", { x: p.x, y: p.y });
      return;
    }
    p.hp -= 1;
    g.stats.damage += 1;
    g.sectorDamage += 1;
    if (g.boss) g.boss.damageTaken = true;
    g.chain = 0;
    g.chainT = 0;
    g.mult = 1;
    const lost = weaponToLose(p);
    if (lost) {
      loseWeapon(p, lost);
      g.recover = { type: lost, until: g.t + DROPS.recoverFor };
      g.sinceCap += DROPS.recoverBoost;
    }
    p.inv = PLAYER.invuln;
    g.mercy = DIRECTOR.mercy;
    g.sinceHit = 0;
    clearShotsNear(30);
    g.hitstop = 0.06;
    emit("hurt", { hp: p.hp, lost, cause, x: p.x, y: p.y });
    if (p.hp <= 0) die(cause);
  }

  function clearShotsNear(r) {
    compact(g.shots, (s) => Math.hypot(s.x - p.x, s.y - p.y) > r);
  }

  function die(cause) {
    g.status = "dying";
    g.endT = 0;
    g.stats.cause = cause;
    g.lasers.length = 0;
    g.beam = null;
    g.droneBeams.length = 0;
    emit("dead", { x: p.x, y: p.y, cause });
  }

  function summary() {
    const st = g.stats;
    return {
      score: Math.round(g.score),
      sector: g.sector,
      dur: g.t,
      crystals: g.crystals,
      ship: p.ship,
      ...st,
      killsBy: { ...st.killsBy },
      killsType: { ...st.killsType },
      capsBy: { ...st.capsBy },
    };
  }
  g.summary = summary;

  // ---------- tempo e fases ----------

  function timers(dt) {
    if (p.inv > 0) p.inv -= dt;
    if (g.mercy > 0) g.mercy -= dt;
    g.sinceHit += dt;
    if (g.phase !== "boss") g.sinceCap += dt;
    if (g.chainT > 0) {
      g.chainT -= dt;
      if (g.chainT <= 0) {
        g.chain = 0;
        g.mult = 1;
      }
    }
    if (g.crystalT > 0) g.crystalT -= dt;
    if (g.turboT > 0) {
      g.turboT -= dt;
      g.turboMeter = TURBO.full * Math.max(0, g.turboT / TURBO.dur);
      if (g.turboT <= 0) {
        g.turboMeter = 0;
        emit("turbo", { on: false });
      }
    }
    if (!p.shield && p.shieldRegen > 0) {
      p.shieldT += dt;
      if (p.shieldT >= p.shieldRegen) {
        p.shield = true;
        p.shieldT = 0;
        emit("shield_up", {});
      }
    }
  }

  function phases(dt) {
    g.phaseT += dt;
    if (g.phase === "waves") {
      g.sectorT += dt;
      if (g.sectorT >= g.sectorLen) setPhase("clear");
    } else if (g.phase === "clear") {
      if ((g.enemies.length === 0 && g.queue.length === 0) || g.phaseT > 6) {
        setPhase("warn");
        emit("boss_warn", { name: g.nextBoss().name });
      }
    } else if (g.phase === "warn") {
      if (g.phaseT >= 2.6) {
        const hpScale = g.scale.hp * (g.firstRun && g.sector === 1 ? 0.6 : 1);
        g.boss = makeBoss(g.bossN, H, hpScale);
        setPhase("boss");
        emit("boss_start", { name: g.boss.name });
      }
    } else if (g.phase === "after" && g.phaseT >= 3.2) {
      g.sector += 1;
      g.sectorT = 0;
      g.sectorLen = sectorLength(g.sector);
      g.scale = sectorScale(g.sector);
      g.magnetAll = false;
      g.sectorDamage = 0;
      g.waveT = 1.5;
      setPhase("waves");
      emit("sector", { n: g.sector, name: sectorInfo(g.sector).name });
    }
  }

  function setPhase(name) {
    g.phase = name;
    g.phaseT = 0;
  }

  function cleanup() {
    compact(g.bullets, (b) => !b.dead && b.y > -12 && b.y < H + 12 && b.x > -12 && b.x < W + 12);
    if (g.bullets.length > PERF.bullets) g.bullets.splice(0, g.bullets.length - PERF.bullets);
    compact(g.rockets, (r) => !r.dead && r.life > 0 && r.y > -20 && r.y < H + 20 && r.x > -20 && r.x < W + 20);
    compact(g.enemies, (e) => !e.dead && !e.gone);
    compact(g.shots, (s) => !s.dead && s.y < H + 12 && s.y > -40 && s.x > -12 && s.x < W + 12);
    compact(g.items, (it) => !it.dead && it.y < H + 12 && it.y > -60 && it.x > -20 && it.x < W + 20);
    compact(g.lasers, (l) => l.t < l.warn + l.fire && g.boss === l.boss);
  }

  return g;
}

function compact(arr, keep) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (keep(v)) arr[j++] = v;
  }
  arr.length = j;
}
