# RAJADA 1.1: evolução infinita — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** armas sem teto com formas a cada 5 níveis e cores por faixa, loot com
raridade, começo cheio e inimigos cada vez mais resistentes, e 6 chefes em alta
definição, com metas visíveis e coleção.

**Architecture:** regras puras novas em `src/power.js` (progressão e cores) e
`src/loot.js` (raridade), tabelas em `src/config.js` como hoje, e a partida
(`src/game.js`) só aplica. O canvas passa a ter o dobro de pixels por dentro
(`RES = 2`) e sprites marcados como alta definição usam essa resolução; o editor
de pixels sai de `sprites.js` para `src/pixel.js` e a arte nova fica em
`src/art-*.js`.

**Tech Stack:** JavaScript puro (módulos ES), Canvas 2D, Web Audio, `node --test`,
Playwright (já instalado) para fumaça, prints e desempenho, esbuild no build.

**Spec:** `rajada/docs/superpowers/specs/2026-10-27-evolucao-infinita-design.md`

Todos os caminhos abaixo são relativos a `rajada/`. Comandos rodam dentro de
`rajada/`.

## Global Constraints

- Nenhuma dependência nova no app; só JavaScript puro.
- Sem pagar para ganhar; sorteios de raridade só gratuitos, dentro do jogo.
- Tetos: 9 canos por rajada, 8 foguetes por salva, 4 drones; 60 inimigos, 220 tiros inimigos, 260 tiros da nave.
- Vida dos inimigos: `1 + 0,35 × (setor − 1)`, sem teto.
- Mundo continua com 224 de largura; canvas com `RES = 2`; alta definição só nos 6 chefes, Couraçado, Portador e pedra grande.
- 60 quadros por segundo com CPU 4× mais lenta no pior caso; `buildSprites` em até 300 ms.
- "Reduzir movimento" desliga câmera lenta, rastro e tremores; nenhum clarão de área grande mais de 3 vezes por segundo.
- Botões com 44 px ou mais; textos em português, diretos, sem exclamação.
- Saves antigos abrem sem perder nada (`PROFILE_VERSION` continua 1; campos novos com padrão).
- Toda tarefa termina com `npm test` passando; tarefas que mexem na tela também com `npm run build && npm run smoke`.
- Commits em português, terminando com:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` e
  `Claude-Session: https://claude.ai/code/session_013TmpE5AWvZ5TeNUAEk1RYR`.

## Review Focus

1. Save antigo (sem os campos novos e com níveis de hangar da tabela velha) abre sem perder cristais, melhorias e recordes → teste na Tarefa 17.
2. Nível de arma altíssimo num celular de 320 px: o rótulo do placar continua curto (no máximo 7 caracteres, como `87★11`) → teste na Tarefa 1.
3. Pausar, sair do app ou girar a tela durante a câmera lenta da lendária: a velocidade volta ao normal e o canvas continua com 448 de largura e nítido → testes nas Tarefas 9 e 16.
4. Setores muito altos (200, volta 33): as paletas das voltas se repetem sem cor indefinida e a vida continua um número finito → teste na Tarefa 8.
5. Cápsula de suporte rara ou melhor com casco e escudo cheios: o bônus de raridade continua valendo → teste na Tarefa 4.

---

## Fase 1: armas sem teto e loot com raridade

### Task 1: matemática do poder (`src/power.js`)

**Files:**
- Create: `src/power.js`, `tests/power.test.js`
- Modify: `src/config.js` (perto de `TURBO`, linha ~100)

**Interfaces:**
- Produces (config.js):
  - `POWER = { perLevel: 0.1, starFrom: 35, starEvery: 5, starBonus: 0.15, band: 5, rainbowBand: 10, ramps }`, onde `ramps` é uma lista de 10 trios `[claro, médio, escuro]`:
    branco `["#ffffff","#f4f7ff","#b9c3dc"]`, amarelo `["#fff4b0","#ffd23f","#ff8a2a"]`,
    laranja `["#ffd9a8","#ff8a2a","#b4501a"]`, vermelho `["#ffb3b3","#ff3d55","#9c1a33"]`,
    rosa `["#ffb3dc","#ff5fb4","#a01f72"]`, violeta `["#d6bcff","#a46bff","#5a2fae"]`,
    azul `["#7cb4ff","#3d6bff","#2c3f86"]`, ciano `["#c4fcff","#48e4f0","#3d6bff"]`,
    verde `["#b6ffc4","#4ee36a","#1d8f45"]`, dourado `["#ffffff","#ffd23f","#c8902a"]`.
  - `GUN_FORMS = [{ at, id, name }]`: `1 rajada Rajada`, `5 leque Leque`, `10 pesada Pesada`, `15 perfurante Perfurante`, `20 cacadora Caçadora`, `25 raio Raio`, `30 tempestade Tempestade`, `35 estelar Estelar`.
- Produces (power.js):
  - `bandOf(level) → 0..10` = `min(10, floor(level / 5))`
  - `starsOf(level) → int` = `level >= 35 ? floor((level − 35) / 5) + 1 : 0`
  - `damageMult(level) → number` = `(1 + 0,1 × (level − 1)) × (1 + 0,15 × starsOf(level))`
  - `gunForm(level) → { at, id, name }` (a última forma com `at <= level`)
  - `nextMilestone(level) → { at, label, missing }` (próximo múltiplo de 5; `label` é o nome da forma até o 30 e `★N` a partir do 35)
  - `weaponLabel(level) → string` (`"12"`; com estrelas `"87★11"`)
  - `rampOf(band, t) → [claro, médio, escuro]` (faixa 10 percorre 6 rampas: amarelo, laranja, vermelho, violeta, azul e verde, uma a cada 0,1 s)

- [ ] **Step 1: escrever os testes que falham** em `tests/power.test.js`:

```js
test("faixa de cor muda nos marcos e vira arco-íris no 50", () => {
  assert.deepEqual([1, 4, 5, 9, 10, 45, 49, 50, 51, 500].map(bandOf), [0, 0, 1, 1, 2, 9, 9, 10, 10, 10]);
});
test("estrelas a partir do 35, uma a cada 5 níveis", () => {
  assert.deepEqual([34, 35, 39, 40, 87].map(starsOf), [0, 1, 1, 2, 11]);
});
test("dano cresce a cada nível, sem teto", () => {
  assert.equal(damageMult(1), 1);
  assert.ok(Math.abs(damageMult(11) - 2) < 1e-9);
  for (let lv = 2; lv <= 300; lv++) assert.ok(damageMult(lv) > damageMult(lv - 1));
});
test("formas da metralhadora nos níveis certos", () => {
  assert.deepEqual([1, 4, 5, 10, 15, 20, 25, 30, 35, 200].map((l) => gunForm(l).id),
    ["rajada", "rajada", "leque", "pesada", "perfurante", "cacadora", "raio", "tempestade", "estelar", "estelar"]);
});
test("próximo marco: forma até o 30, depois estrela", () => {
  assert.deepEqual(nextMilestone(4), { at: 5, label: "Leque", missing: 1 });
  assert.deepEqual(nextMilestone(12), { at: 15, label: "Perfurante", missing: 3 });
  assert.deepEqual(nextMilestone(33), { at: 35, label: "★1", missing: 2 });
  assert.deepEqual(nextMilestone(40), { at: 45, label: "★3", missing: 5 });
});
test("rótulo do placar cabe num celular estreito", () => {
  assert.equal(weaponLabel(12), "12");
  assert.equal(weaponLabel(87), "87★11");
  for (const lv of [1, 34, 35, 99, 999]) assert.ok(weaponLabel(lv).length <= 7);
});
test("arco-íris troca de rampa com o tempo; faixas normais não", () => {
  assert.deepEqual(rampOf(3, 0), rampOf(3, 5));
  assert.notDeepEqual(rampOf(10, 0), rampOf(10, 0.1));
});
```

- [ ] **Step 2: rodar e ver falhar** — `node --test tests/power.test.js` → FAIL (módulo não existe).
- [ ] **Step 3: adicionar `POWER` e `GUN_FORMS` em `src/config.js` e implementar `src/power.js`** com as assinaturas acima (só importa de `config.js`).
- [ ] **Step 4: rodar** — `npm test` → PASS.
- [ ] **Step 5: commit** — `git add src/power.js src/config.js tests/power.test.js && git commit` ("RAJADA: progressão das armas (faixas, estrelas, formas)").

### Task 2: armas sem teto (`src/weapons.js`) e fim dos máximos

**Files:**
- Modify: `src/weapons.js` (inteiro), `src/config.js` (`GUN`, `ROCKETS`, `DRONES`, linhas 74–98), `src/drops.js:1-85`, `src/progress.js:16,112-126`, `src/game.js:279-306` (`firePlayer`)
- Test: `tests/weapons.test.js` (reescrever os testes de máximo), `tests/meta.test.js`

**Interfaces:**
- Consumes: Tarefa 1 (`damageMult`, `bandOf`, `gunForm`).
- Produces (weapons.js; os exports `GUN_MAX`, `ROCKETS_MAX`, `DRONES_MAX` deixam de existir):
  - `gunVolley(level, x, y, volley = 0) → Bullet[]`, `Bullet = { x, y, vx, vy, dmg, big, pierce, homing, band }`
  - `gunInterval(level, turbo = false) → s`: 0,125 no nível 1, linear até 0,075 no 30, constante depois; turbo × `TURBO.fireMult`
  - `gunBeam(level) → null | { width: 4, tick: 0.1, dmg, band }` (a partir do 25; `dmg = 1,2 × damageMult(level)`)
  - `rocketSpec(level, turbo = false) → null | { every, count, dmg, splash, splashDmg, frag, band }`
  - `rocketLaunch(level, x, y) → Rocket[]` (mesma disposição em pares de hoje, até 8); `Rocket = { x, y, angle, speed, life, target, dmg, splash, splashDmg, frag }`, com os valores de `rocketSpec(level)` copiados em cada foguete
  - `droneSpec(level) → { count, every, dmg, beam, band }`
  - `droneVolley(level, x, y) → Bullet[]` (1 tiro até o nível 4; 2 em leque de ±6° do 5 ao 9; nenhum com raio)
  - `estimateDps(p) → number` (soma metralhadora, raio, foguetes e drones; usado na Tarefa 8)
  - drops.js: `weaponToLose(p) → "M" | "F" | "D" | null` = a de maior nível entre M (se `gun > 1`), F (se `rockets > 0`) e D (se `drones > 0`); empate na ordem M, F, D
- Valores (config.js):
  - `GUN.patterns`: `rajada` = os 4 padrões de hoje (níveis 1 a 4); `leque` = o padrão de 5 canos de hoje; `pesada` = leque + `[-8,-20],[8,20]` (7 canos, `big`, dano ×1,4); `perfurante` = pesada com `pierce: 1`; `cacadora` = pesada com os 2 canos de fora `homing`; `raio` = pesada sem o cano central (6) + feixe; `tempestade` e `estelar` = pesada + `[-10,-28],[10,28]` (9), com os ângulos somando +6° nas rajadas pares e −6° nas ímpares.
  - Foguetes por nível: `count` 1, 2, 2, 4 (1 a 4), 6 (5 a 9), 8 (10+); `every` 1, 1, 0,7, 0,7, 0,6 (5 a 9), 0,5 (10+); `dmg = 4 × damageMult`; `splashDmg = 2 × damageMult`; `frag = 4` a partir do 15; `splash = 12 × min(2, 1 + 0,1 × floor((nível − 15) / 5))` a partir do 20, senão 12.
  - Drones: `count = min(nível, 4)`; `every = 0,18 / min(2, 1 + 0,05 × max(0, nível − 4))`; `dmg = 0,8 × damageMult`; `beam` a partir do 10; `DRONES.offset` ganha `[-28, 14]` e `[28, 14]`.

- [ ] **Step 1: reescrever `tests/weapons.test.js`** (mantendo os testes de foguete teleguiado) com:

```js
test("metralhadora: canos por nível até a Tempestade, nunca mais de 9", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10, 15, 20, 25, 30, 200].map((l) => gunVolley(l, 100, 300).length),
    [1, 2, 3, 4, 5, 7, 7, 7, 6, 9, 9]);
});
test("nível 200 funciona e bate mais que o 199", () => {
  assert.ok(gunVolley(200, 0, 0)[0].dmg > gunVolley(199, 0, 0)[0].dmg);
});
test("Perfurante atravessa, Caçadora tem 2 teleguiados, Raio tem feixe", () => {
  assert.equal(gunVolley(14, 0, 0)[0].pierce, 0);
  assert.equal(gunVolley(15, 0, 0)[0].pierce, 1);
  assert.equal(gunVolley(20, 0, 0).filter((b) => b.homing).length, 2);
  assert.equal(gunBeam(24), null);
  assert.equal(gunBeam(25).width, 4);
});
test("cor do tiro acompanha a faixa", () => {
  assert.equal(gunVolley(12, 0, 0)[0].band, 2);
  assert.equal(gunVolley(50, 0, 0)[0].band, 10);
});
test("cadência vai de 0,125 a 0,075 e para no 30; turbo pela metade", () => {
  assert.equal(gunInterval(1), 0.125);
  assert.ok(Math.abs(gunInterval(30) - 0.075) < 1e-9);
  assert.equal(gunInterval(90), gunInterval(30));
  assert.equal(gunInterval(7, true), gunInterval(7) * 0.5);
});
test("foguetes: 1, 2, 2, 4, 6, 8 e fragmentação no 15", () => {
  assert.deepEqual([1, 2, 3, 4, 5, 10, 15, 100].map((l) => rocketLaunch(l, 0, 0).length), [1, 2, 2, 4, 6, 8, 8, 8]);
  assert.equal(rocketSpec(14).frag, 0);
  assert.equal(rocketSpec(15).frag, 4);
  assert.equal(rocketSpec(100).splash, 24);
});
test("drones: até 4, cadência até 2×, raio no 10", () => {
  assert.equal(droneSpec(7).count, 4);
  assert.equal(droneSpec(100).every, 0.09);
  assert.equal(droneSpec(10).beam, true);
  assert.equal(droneVolley(12, 0, 0).length, 0);
});
test("ao levar dano perde a arma de maior nível (empate: metralhadora)", () => {
  assert.equal(weaponToLose({ gun: 12, rockets: 12, drones: 3 }), "M");
  assert.equal(weaponToLose({ gun: 3, rockets: 7, drones: 2 }), "F");
  assert.equal(weaponToLose({ gun: 1, rockets: 0, drones: 0 }), null);
});
```

- [ ] **Step 2: rodar e ver falhar** — `node --test tests/weapons.test.js` → FAIL.
- [ ] **Step 3: implementar** as funções acima em `src/weapons.js`; em `src/drops.js` tirar os pesos de "no máximo" de `capsuleWeights` (M: 3 até o nível 3, depois 2; F: 2,5 sem foguetes, depois 2; D: 0 antes de 20 s, depois 1,5) e fazer `applyCapsule` nunca devolver `max` para M, F e D; em `src/progress.js` tirar `Math.min(GUN_MAX…)`/`ROCKETS_MAX` de `loadoutFor`; em `firePlayer` usar `gunVolley(p.gun, x, y, p.volley++)` e `droneSpec(p.drones)`/`droneVolley(p.drones, …)`.
- [ ] **Step 4: rodar** — `npm test` → PASS.
- [ ] **Step 5: commit** ("RAJADA: armas sem nível máximo").

### Task 3: perfurar, teleguiar, raio e fragmentação na partida

**Files:**
- Modify: `src/game.js` (`firePlayer` 279–306, `moveWorld` 366–390, `collide` 445–486, `cleanup` 845–856), `src/config.js` (`PERF = { enemies: 60, shots: 220, bullets: 260 }`)
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: Tarefa 2 (`gunBeam`, `rocketSpec().frag`, `droneSpec().beam`, `Bullet.pierce/homing`).
- Produces (estado lido pelo desenho na Tarefa 6): `g.beam` (`null | { x, width, band }`, atualizado a cada passo), `g.droneBeams` (`[{ x, y, len }]`), tiros com `hits: []`, estilhaços com `shard: true`.
- Valores: teleguiado escolhe alvo a cada 0,25 s (reaproveita `pickTarget`), curva até 6 rad/s, vive 1,2 s; estilhaços: 4 tiros a 45°, 135°, 225° e 315°, velocidade 160, dano `splashDmg`, vida 0,35 s; raio do drone: 40 de comprimento, dano `1,5 × droneSpec().dmg` a cada 0,1 s; acima de 260 tiros da nave, os mais antigos somem primeiro.

- [ ] **Step 1: escrever os testes que falham** em `tests/game.test.js` (usar `play()`/`run()` que já existem; `p.gunT = 99` impede a rajada automática de atrapalhar):

```js
const addEnemy = (g, x, y, hp = 100) => {
  const e = makeEnemy("couracado", { x, y, vx: 0, vy: 0, move: "down" });
  e.hp = e.maxHp = hp;
  g.enemies.push(e);
  return e;
};
const quiet = (g) => { g.player.gunT = 99; g.player.rockets = 0; g.player.drones = 0; };

test("tiro perfurante atravessa o primeiro inimigo e para no segundo", () => {
  const { g } = play();
  quiet(g);
  const [a, b, c] = [150, 110, 70].map((y) => addEnemy(g, 112, y));
  g.bullets.push({ x: 112, y: 200, vx: 0, vy: -330, dmg: 1, pierce: 1, hits: [], band: 3 });
  run(g, 0.5);
  assert.equal(a.hp, 99);
  assert.equal(b.hp, 99);
  assert.equal(c.hp, 100);
});
test("tiro teleguiado curva para o inimigo mais perto", () => {
  const { g } = play();
  quiet(g);
  addEnemy(g, 190, 120);
  const bullet = { x: 112, y: 250, vx: 0, vy: -330, dmg: 1, pierce: 0, homing: true, life: 1.2, hits: [], band: 4 };
  g.bullets.push(bullet);
  run(g, 0.3);
  assert.ok(bullet.vx > 0);
});
test("Raio dá dano a quem está na coluna da nave e não aos de fora", () => {
  const { g } = play();
  quiet(g);
  g.player.gun = 25;
  const inside = addEnemy(g, g.player.x, 120);
  const outside = addEnemy(g, g.player.x + 40, 120);
  run(g, 0.5);
  assert.ok(inside.hp < 100);
  assert.equal(outside.hp, 100);
});
test("foguete com fragmentação solta 4 estilhaços ao explodir", () => {
  const { g, events } = play();
  quiet(g);
  g.player.rockets = 15;
  g.player.rocketT = 0;
  addEnemy(g, g.player.x, g.player.y - 60);
  let shards = 0;
  for (let i = 0; i < 120 && !events.some((e) => e.type === "explode"); i++) {
    g.update(DT);
    shards = g.bullets.filter((b) => b.shard).length;
  }
  assert.equal(shards, 4);
});
test("nível 200 em tudo: 30 s sem erro e no máximo 260 tiros da nave", () => {
  const { g } = play();
  Object.assign(g.player, { gun: 200, rockets: 200, drones: 200 });
  const bot = createBot({ skill: 0.9, seed: 2 });
  let most = 0;
  run(g, 30, (game) => { bot.drive(game, DT); most = Math.max(most, game.bullets.length); });
  assert.ok(most <= 260);
});
```
- [ ] **Step 2: rodar e ver falhar** — `node --test tests/game.test.js` → FAIL.
- [ ] **Step 3: implementar** em `game.js`: `pierce` com `hits`; teleguiado no `moveWorld`; raio por tique de 0,1 s contra inimigos e chefe vulnerável; estilhaços na explosão do foguete; raio dos drones; teto de tiros da nave.
- [ ] **Step 4: rodar** — `npm test` → PASS.
- [ ] **Step 5: commit** ("RAJADA: tiros perfurantes, teleguiados, raio e fragmentação").

### Task 4: raridade do loot (`src/loot.js`)

**Files:**
- Create: `src/loot.js`, `tests/loot.test.js`
- Modify: `src/config.js` (`RARITIES`, `RARITY`, `LOOT`, `ROCKET_MARKS`, `DRONE_MARKS`), `src/drops.js` (`applyCapsule`)

**Interfaces:**
- Consumes: Tarefa 1 (`nextMilestone`, `gunForm`).
- Produces (config.js):
  - `RARITIES = ["comum", "rara", "epica", "lendaria"]`
  - `RARITY = { comum: { color: null, gain: 1 }, rara: { color: "#3d6bff", gain: 2, turbo: 20 }, epica: { color: "#a46bff", gain: 3, all: 1 }, lendaria: { color: "#ffd23f", toMilestone: true, minGain: 3, all: 1, turboFull: true } }`
  - `LOOT = { sources: { inimigo: [0.88, 0.11, 0.01, 0], portador: [0.6, 0.35, 0.05, 0], elite: [0.3, 0.5, 0.18, 0.02], couracado: [0, 0.7, 0.27, 0.03], chefe1: [0, 0, 0.85, 0.15], chefe2: [0.3, 0.5, 0.2, 0] }, pityCommons: 6, legendaryBosses: 3, luckShift: 0.02, minCommon: 0.4 }`
  - `ROCKET_MARKS = { 5: "Salva de 6", 10: "Salva de 8", 15: "Fragmentação" }`, `DRONE_MARKS = { 4: "Esquadrilha", 10: "Raios" }`
- Produces (loot.js):
  - `newPity() → { commons: 0, bossesNoLegend: 0 }`
  - `rarityWeights(source, luckLevel = 0) → number[4]` (cada nível de Sorte tira 0,02 da comum e reparte entre as outras na proporção delas; a comum nunca abaixo de `minCommon` quando começa acima dele)
  - `rollRarity(rng, source, pity, luckLevel = 0) → rarity`: usa `rng.next()` uma vez e escolhe pela soma acumulada dos pesos, pulando pesos zero; atualiza `pity` (6 comuns seguidas forçam rara ou melhor, tirando a comum e renormalizando; em `chefe1`, depois de 2 chefes sem lendária a terceira vem lendária)
  - `levelGain(rarity, weapon, level) → int` (lendária de M vai até `nextMilestone(level).at`, de F/D até o próximo múltiplo de 5, mínimo 3)
- Produces (drops.js): `applyCapsule(p, type, rarity = "comum") → { gained: { M?, F?, D? }, level, form, turbo }`; `form` é o nome da forma, estrela, ou marca de foguete/drone cruzada (senão `null`); `turbo` é `0`, `20` ou `"cheio"`.

- [ ] **Step 1: escrever os testes que falham** em `tests/loot.test.js`:

```js
test("chance por origem segue a tabela", () => {
  const rng = createRng(3);
  const count = { comum: 0, rara: 0, epica: 0, lendaria: 0 };
  for (let i = 0; i < 10000; i++) count[rollRarity(rng, "inimigo", newPity())] += 1;
  assert.ok(Math.abs(count.comum / 10000 - 0.88) <= 0.01);
  assert.ok(Math.abs(count.rara / 10000 - 0.11) <= 0.01);
  for (let i = 0; i < 2000; i++) assert.notEqual(rollRarity(rng, "couracado", newPity()), "comum");
});
const zero = { next: () => 0 }; // sempre o primeiro peso que não é zero
test("depois de 6 comuns seguidas, a próxima é rara ou melhor", () => {
  const pity = newPity();
  const got = Array.from({ length: 7 }, () => rollRarity(zero, "inimigo", pity));
  assert.deepEqual(got.slice(0, 6), Array(6).fill("comum"));
  assert.equal(got[6], "rara");
});
test("pelo menos uma lendária a cada 3 chefes", () => {
  const pity = newPity();
  const got = Array.from({ length: 9 }, () => rollRarity(zero, "chefe1", pity));
  assert.deepEqual(got, ["epica", "epica", "lendaria", "epica", "epica", "lendaria", "epica", "epica", "lendaria"]);
});
test("Sorte tira 2 pontos da comum por nível, até 40%", () => {
  assert.ok(Math.abs(rarityWeights("inimigo", 1)[0] - 0.86) < 1e-9);
  assert.equal(rarityWeights("inimigo", 30)[0], 0.4);
  assert.ok(Math.abs(rarityWeights("inimigo", 7).reduce((a, b) => a + b) - 1) < 1e-9);
});
test("lendária leva até o próximo marco, no mínimo +3", () => {
  assert.equal(levelGain("lendaria", "M", 12), 3);
  assert.equal(levelGain("lendaria", "M", 14), 3);
  assert.equal(levelGain("lendaria", "M", 15), 5);
});
test("épica de suporte dá +1 em todas as armas mesmo com casco e escudo cheios", () => {
  const p = { gun: 3, rockets: 0, drones: 0, hp: 3, maxHp: 3, shield: true };
  assert.deepEqual(applyCapsule(p, "H", "epica").gained, { M: 1, F: 1, D: 1 });
});
test("comum de metralhadora no 4 vira Leque e avisa a forma", () => {
  assert.equal(applyCapsule({ gun: 4, rockets: 0, drones: 0, hp: 3, maxHp: 3 }, "M", "comum").form, "Leque");
});
```

- [ ] **Step 2: rodar e ver falhar** — `node --test tests/loot.test.js` → FAIL.
- [ ] **Step 3: implementar** `src/loot.js` e o novo `applyCapsule` (Reparo e Escudo cheios não viram mais "máximo": aplicam o efeito que couber e os extras da raridade).
- [ ] **Step 4: rodar** — `npm test` → PASS.
- [ ] **Step 5: commit** ("RAJADA: loot com raridade e garantias").

### Task 5: raridade dentro da partida

**Files:**
- Modify: `src/game.js` (`g.pity`, `dropCapsule`, `killEnemy`, `bossDefeated`, `collectCapsule`)
- Test: `tests/game.test.js`

**Interfaces:**
- Consumes: Tarefa 4 (`newPity`, `rollRarity`, `applyCapsule`).
- Produces: `dropCapsule(x, y, forced, source = "inimigo")`; item `{ kind: "cap", type, rarity }`; eventos `"cap_spawn" { type, rarity, x, y }`, `"cap" { type, rarity, gained, level, form, x, y }` e o novo `"form" { weapon, name, band }`.
- Origem: Portador → `portador`; Couraçado → `couracado`; elite (Tarefa 8) → `elite`; demais → `inimigo`; chefe: 1ª cápsula `chefe1`, 2ª `chefe2`; cápsulas do roteiro da primeira partida são sempre comuns; nível de Sorte vem de `loadout.luckLevel` (`DEFAULT_LOADOUT` ganha `luckLevel: 0`; o hangar passa a preencher na Tarefa 17).

- [ ] **Step 1: escrever os testes que falham**:
  - `"chefe solta uma cápsula épica ou melhor"`: derrotar o chefe com `g.boss.hp = 1`; uma das cápsulas novas é `epica` ou `lendaria`.
  - `"Couraçado nunca solta cápsula comum"`: 20 sementes; `couracado` abatido nunca solta `comum`.
  - `"lendária de metralhadora no 3 leva ao 6 e avisa a forma Leque"`: item `{ type: "M", rarity: "lendaria" }` na nave; `p.gun === 6` e evento `form` com `name: "Leque"`.
  - `"cápsulas do tutorial continuam comuns"`: primeira partida, as 3 cápsulas do roteiro chegam como `comum`.
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar** (turbo da rara soma 20 no medidor; lendária enche o TURBO).
- [ ] **Step 4: rodar** — `npm test` → PASS.
- [ ] **Step 5: commit** ("RAJADA: raridade nas cápsulas da partida").

### Task 6: cor dos tiros, cápsulas com raridade e barra da próxima forma

**Files:**
- Modify: `src/render.js` (`drawPlayerShots`, `drawItems`, eventos `cap`, `cap_spawn`, `form`), `src/main.js` (placar, eventos, QA), `src/audio.js` (`rarity(r)`, `form()`), `index.html` (placar: `<div id="hud-next" class="hud-next">`), `style.css`
- Test: `tests/smoke.mjs`

**Interfaces:**
- Consumes: Tarefas 1, 3 e 5 (`rampOf`, `weaponLabel`, `nextMilestone`, `g.beam`, `g.droneBeams`, eventos).
- Produces: QA `window.__rajada.capsule(type, rarity = "comum")` e `window.__rajada.level(weapon, n)` (põe M, F ou D no nível `n`).
- Desenho: tiro com o mesmo formato de hoje (`tiro` 2×5, `tiro_max` 3×6) pintado pela rampa da faixa (cabeça clara, corpo médio, cauda escura); raio como feixe com as 3 cores da rampa; cápsula rara ou melhor com anel na cor da raridade; texto da cápsula: `METRALHADORA +2` (rara) ou `LENDÁRIA · LEQUE`.
- Placar: cada arma mostra `weaponLabel(nível)` na cor média da faixa; `#hud-next` mostra `faltam N para FORMA` (`falta 1 para…` no singular) e uma barra com o avanço dentro do bloco de 5 níveis.
- Evento `form`: anel na cor da faixa em volta da nave, nome da forma em letras grandes no centro por 1,2 s, `audio.form()` e vibração curta.

- [ ] **Step 1: escrever a checagem que falha** em `tests/smoke.mjs` (computador e celular): `__rajada.level("M", 37)` e depois o chip da metralhadora mostra `37★1` e `#hud-next` mostra `faltam 3 para ★2`; `__rajada.capsule("M", "lendaria")`; print em `tests/prints/armas.png`.
- [ ] **Step 2: rodar e ver falhar** — `npm run build && npm run smoke` → FAIL.
- [ ] **Step 3: implementar** desenho, placar, sons e ganchos de QA.
- [ ] **Step 4: rodar** — `npm test && npm run build && npm run smoke` → `ok computador`, `ok celular`; abrir `tests/prints/armas.png` e conferir tiros na cor da faixa e o placar.
- [ ] **Step 5: commit** ("RAJADA: tiros coloridos, cápsulas raras e próxima forma no placar").

## Fase 2: dificuldade

### Task 7: começo cheio e vida +35% por setor

**Files:**
- Modify: `src/config.js` (`sectorScale`, `SECTORS`, `WAVES`), `src/waves.js` (`buildWave`), `src/game.js` (setor no `buildWave`, calma da primeira partida, contadores do setor 1), `tests/balance.mjs`
- Test: `tests/director.test.js`, `tests/game.test.js`

**Interfaces:**
- Produces:
  - `sectorScale(n) → { hp: 1 + 0,35(n−1), cap: min(60, 18 + 5(n−1)), gap: max(0,6, 1,4 / (1 + 0,18(n−1))), fire: min(3, 1 + 0,28(n−1)), shotSpeed: min(1,6, 1 + 0,07(n−1)) }`
  - `SECTORS` ganha o 6º: `{ name: "Núcleo", bg: ["#2a1a06", "#070402"], star: "#ffe0a8", nebula: ["#b4501a", "#ffd23f"] }`; `sectorInfo` passa a contar voltas de 6 em 6
  - `buildWave(id, rng, W, H, sector = 1)`: `fila` com 8 Zangões nos setores 1 e 2 (5 depois); `v` com 9 nos setores 1 e 2 (7 depois); nova `enxame` com 8 a 12 Zangões espalhados
  - `WAVES`: `fila` ameaça 8, `v` ameaça 9, nova `{ id: "enxame", min: 1, weight: 3, threat: 10 }`
  - estatísticas da partida `s1Spawns` e `s1Time` (inimigos nascidos e tempo de ondas no setor 1)
  - primeira partida: primeira onda aos 3 s (`g.waveT = 3`)

- [ ] **Step 1: medir a base** — em `tests/balance.mjs`, imprimir `inimigos/min no setor 1` (mediana de `s1Spawns / s1Time × 60`) já com os contadores em `game.js`; rodar `npm run balance -- 20` e anotar o número do piloto 0.6 no commit. Commit dos contadores ("RAJADA: medida de inimigos por minuto no setor 1").
- [ ] **Step 2: escrever os testes que falham**:

```js
test("vida +35% por setor, sem teto; limite de inimigos de 18 a 60", () => {
  assert.deepEqual(sectorScale(1), { hp: 1, cap: 18, gap: 1.4, fire: 1, shotSpeed: 1 });
  assert.ok(Math.abs(sectorScale(3).hp - 1.7) < 1e-9);
  assert.equal(sectorScale(20).cap, 60);
  assert.equal(sectorScale(200).gap, 0.6);
  assert.equal(sectorScale(200).fire, 3);
});
test("6 cenários: o 7º setor é Órbita Baixa II", () => {
  assert.equal(sectorInfo(6).name, "Núcleo");
  assert.equal(sectorInfo(7).name, "Órbita Baixa II");
});
test("ondas do começo: fila de 8, V de 9, enxame de 8 a 12", () => {
  const rng = createRng(1);
  assert.equal(buildWave("fila", rng, 224, 400, 1).length, 8);
  assert.equal(buildWave("fila", rng, 224, 400, 3).length, 5);
  assert.equal(buildWave("v", rng, 224, 400, 2).length, 9);
  assert.equal(buildWave("v", rng, 224, 400, 3).length, 7);
  for (let s = 0; s < 20; s++) {
    const w = buildWave("enxame", createRng(s), 224, 400, 1);
    assert.ok(w.length >= 8 && w.length <= 12);
    assert.ok(w.every((en) => en.type === "zangao"));
  }
});
test("primeira partida: 3 s sem ondas", () => {
  const { g } = play({ firstRun: true });
  run(g, 2.9);
  assert.equal(g.enemies.length + g.queue.length, 0);
});
```

- [ ] **Step 3: rodar e ver falhar** — FAIL.
- [ ] **Step 4: implementar.**
- [ ] **Step 5: rodar** — `npm test` → PASS; `npm run balance -- 20` → inimigos/min no setor 1 pelo menos 1,8× a base do Step 1 (critério S4).
- [ ] **Step 6: commit** ("RAJADA: começo com o dobro de inimigos e vida +35% por setor").

### Task 8: elites, voltas e tetos de desempenho

**Files:**
- Modify: `src/config.js` (`ELITE`, `LAPS`, `lapOf`, `DIRECTOR.strongRatio`), `src/enemies.js` (`makeEnemy`, ataques das voltas), `src/game.js` (sorteio de elite, origem `elite`, cristais ×2, tetos `PERF.enemies` e `PERF.shots`, `strong` por `estimateDps`), `src/sprites.js` (variações `nome@elite`, `nome@1`…`@3`), `src/render.js` (escolha da variação; volta acima de 3 com brilho 0,15)
- Test: `tests/game.test.js`, `tests/director.test.js`, `tests/sprites.test.js` (novo)

**Interfaces:**
- Consumes: Tarefa 2 (`estimateDps`), Tarefa 5 (origem de loot).
- Produces:
  - `ELITE = { from: 4, base: 0.08, perSector: 0.02, max: 0.3, hp: 3, crystals: 2 }` e `eliteChance(sector) → 0..0,3`
  - `lapOf(sector) = floor((sector − 1) / 6)`; `lapSkin(lap) → 0 | 1 | 2 | 3` (0 na volta 0; depois `((lap − 1) % 3) + 1`)
  - `makeEnemy(type, params, hpScale = 1, elite = false)` → `e.elite`, vida ×3
  - ataques das voltas: volta ≥ 1, Atirador dispara leque de 3 (±0,25 rad); volta ≥ 2, Couraçado dispara anel de 12; volta ≥ 3, Mina solta 8 tiros ao morrer
  - sprites: `lapVariant(rows, skin)` troca cores pela tabela `LAP_SWAPS` (carmesim, dourado, sombra); `eliteVariant(rows)` troca o contorno `k` por `y`
  - `DIRECTOR.strongRatio = 3`: arma forte quando `estimateDps(p) / (sectorScale(setor).hp × 6) >= 3`

- [ ] **Step 1: escrever os testes que falham**:
  - `"elites só a partir do setor 4, até 30%"`: `eliteChance(3) === 0`, `eliteChance(4) === 0.08`, `eliteChance(30) === 0.3`.
  - `"elite tem o triplo de vida"`: `makeEnemy("zangao", { x: 0, y: 0 }, 1, true).hp === 3`.
  - `"volta 1: Atirador dispara leque de 3"`.
  - `"setor 200, volta 33: paleta existe e a vida é finita"`: `lapSkin(lapOf(200))` está em 1..3; `Number.isFinite(sectorScale(200).hp)`; `lapVariant` devolve só cores da paleta.
  - `"tetos: nunca mais de 60 inimigos e 220 tiros inimigos"`: `g.jumpTo(25)`, bot por 60 s, máximos observados dentro dos tetos.
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar.**
- [ ] **Step 4: rodar** — `npm test` → PASS; `npm run build && npm run smoke` → ok.
- [ ] **Step 5: commit** ("RAJADA: elites, voltas com paleta nova e tetos de desempenho").

## Fase 3: alta definição

### Task 9: canvas 2× e base para sprites em alta definição

**Files:**
- Create: `src/pixel.js` (editor que sai de `sprites.js`: `grid`, `set`, `rect`, `poly`, `ellipse`, `line`, `stamp`, `mirrorGrid`, `shade`, `outline`, `finish`, `toRows`, `LIGHT`, `DARK`), `src/pixel-hd.js`, `tests/sprites.test.js` (se ainda não existir)
- Modify: `src/sprites.js` (importa o editor; registro `HD_SPRITES`; `sizeOf`; `buildSprites`; `validateSprites`), `src/render.js` (`RES`, `resize`, `draw`, `spr`), `tests/smoke.mjs`

**Interfaces:**
- Produces:
  - pixel-hd.js: `hdGrid(w, h)` (grade 2w × 2h, `w`/`h` em unidades do mundo), `shade3(G)` (luz em cima à esquerda em 2 passos, sombra embaixo à direita em 2 passos), `rim(G, ch)` (brilho de 1 pixel na borda iluminada), `dither(G, x, y, w, h, a, b)` (xadrez entre duas cores), `finishHD(G, { sym })` (espelho, `shade3`, `rim`, `outline`)
  - sprites.js: `HD_SPRITES` (nome → quadros com o dobro de pixels), `isHd(name)`, `worldSize(rows, hd) → { w, h }`, `sizeOf(name)` em unidades do mundo; saída de `buildSprites` com `hd: true` e `w`/`h` do mundo
  - render.js: `export const RES = 2`; canvas com `W × RES` por `H × RES`; `ctx.setTransform(RES, 0, 0, RES, sx × RES, sy × RES)`; `spr` desenha sprite HD com `drawImage(img, left, top, s.w, s.h)`

- [ ] **Step 1: guardar a impressão digital dos sprites** — escrever `"editor movido sem mudar nenhum sprite"`: hash (sha256) do `JSON.stringify(SPRITES)` igual ao valor calculado antes da mudança (rodar uma vez, colar o valor no teste); e `"sprite HD mede metade da grade no mundo"`: `worldSize` de uma grade 4×4 com `hd = true` é `{ w: 2, h: 2 }`.
- [ ] **Step 2: smoke** — checar `canvas.width === 448` depois de começar, mudar o tamanho da janela no meio da partida e checar de novo `448` e `imageSmoothingEnabled === false`.
- [ ] **Step 3: rodar e ver falhar** — `npm test` (worldSize) e `npm run smoke` → FAIL.
- [ ] **Step 4: implementar** (mover o editor sem mudar comportamento; `RES` no desenho).
- [ ] **Step 5: rodar** — `npm test && npm run build && npm run smoke` → PASS; print da partida igual ao de antes a olho.
- [ ] **Step 6: commit** ("RAJADA: canvas em dobro e base para alta definição").

### Task 10: Couraçado, Portador e pedra grande em alta definição

**Files:**
- Create: `src/art-grandes.js` (`couracadoHD(frame)`, `portadorHD(frame)`, `pedraHD(rot)`)
- Modify: `src/sprites.js` (entram em `HD_SPRITES` no lugar das versões de hoje), `scripts/sprites-sheet.mjs` (desenha HD na resolução própria)
- Test: `tests/sprites.test.js`

**Interfaces:**
- Consumes: Tarefa 9 (`hdGrid`, `finishHD`, `dither`).
- Tamanhos no mundo iguais aos de hoje (as caixas de `ENEMIES` não mudam): Couraçado 27×23 (grade 54×46, 2 quadros: luzes e motores alternando), Portador 17×9 (34×18, 2 quadros: cápsula brilhando), pedra grande 17×17 (34×34, 4 rotações).

- [ ] **Step 1: escrever o teste que falha**: `"inimigos grandes em alta definição mantêm o tamanho no mundo"` (`sizeOf` = 27×23, 17×9, 17×17; `isHd` verdadeiro; quadros 2, 2 e 4; `validateSprites()` vazio; quadros diferentes entre si).
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: desenhar** com sombra em 3 tons, brilho na borda e contorno.
- [ ] **Step 4: rodar** — `npm test` → PASS; `npm run sprites` e conferir `tests/prints/sprites.png` (sem pixel solto, contorno fechado, animação visível).
- [ ] **Step 5: commit** ("RAJADA: inimigos grandes em alta definição").

## Fase 4: chefes

### Task 11: seis chefes: rodízio, voltas e armadura que quebra

**Files:**
- Modify: `src/bosses.js` (`makeBoss`, `updateBoss`, `bossSprite`), `src/sprites.js` (`broken(rows)` e variações `_quebrado` e de volta para todo chefe), `src/render.js` (`drawBoss` usa `bossSprite`; `boss_phase` solta pedaços), `src/config.js`
- Test: `tests/game.test.js`, `tests/sprites.test.js`

**Interfaces:**
- Produces:
  - `makeBoss(n, H, hpScale)`: `lap = floor(n / BOSSES.length)` (com 6 chefes, coincide com `lapOf`), `b.skin = lapSkin(lap)`, `b.broken = false`
  - na fase 2: `b.broken = true` (além do que já acontece)
  - `bossSprite(b) → string` = `def.sprite` + `"_quebrado"` se quebrado + `"@skin"` se `skin > 0`
  - `broken(rows) → rows`: tira os pixels de armadura (`g`, `l`, `d`) num padrão determinístico de cerca de 15% e risca rachaduras com `k`
  - `spriteNames() → string[]` (todos os nomes que `buildSprites` gera; usado nos testes)

- [ ] **Step 1: escrever os testes que falham**:
  - `"chefes em rodízio na ordem da lista; a volta conta pelo tamanho da lista"`: `makeBoss(n).id` para `n` de 0 a `BOSSES.length − 1` segue `BOSSES`; `makeBoss(BOSSES.length).lap === 1`.
  - `"fase 2 quebra a armadura e troca o sprite"`: vida abaixo de 50% → `updateBoss` devolve `"phase2"`, `b.broken`, `bossSprite(b)` termina com `_quebrado`.
  - `"todo chefe tem sprite inteiro, quebrado e das 3 voltas"`: para cada `BOSSES`, `spriteNames()` inclui `x`, `x_quebrado`, `x@1`, `x_quebrado@3`.
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar.**
- [ ] **Step 4: rodar** — `npm test && npm run build && npm run smoke` → PASS.
- [ ] **Step 5: commit** ("RAJADA: rodízio de chefes, voltas e armadura que quebra").

### Task 12: Colosso, Aranha e Olho em alta definição

**Files:**
- Create: `src/art-chefes.js` (`colossoHD(frame)`, `aranhaHD(frame)`, `olhoHD(lid)`, `irisHD()`)
- Modify: `src/sprites.js` (entram em `HD_SPRITES` no lugar dos de hoje), `scripts/sprites-sheet.mjs` (gera também `tests/prints/chefes.png`: cada chefe inteiro, quebrado e na volta 1)
- Test: `tests/sprites.test.js`

**Interfaces:**
- Consumes: Tarefas 9 e 11.
- Tamanhos no mundo iguais aos de hoje: Colosso 63×41 (grade 126×82, 4 quadros: chamas dos motores pulsando e torretas girando), Aranha 59×46 (118×92, 4 quadros: ciclo das patas), Olho 49×47 (98×94, 3 quadros de pálpebra), íris 11×11 (22×22).

- [ ] **Step 1: escrever o teste que falha**: `"chefes atuais em alta definição mantêm tamanho e caixas"` (tamanhos acima, `isHd`, número de quadros, `validateSprites()` vazio).
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: desenhar.**
- [ ] **Step 4: rodar** — `npm test` → PASS; `npm run sprites` e conferir `tests/prints/chefes.png`.
- [ ] **Step 5: commit** ("RAJADA: Colosso, Aranha e Olho em alta definição").

### Task 13: Serpente

**Files:**
- Modify: `src/config.js` (`BOSSES` + `{ id: "serpente", name: "Serpente", sprite: "serpente", hp: 480, score: 8000, y: 0.25, box: [22, 18], segments: 10, spacing: 9 }`), `src/bosses.js` (gomos, movimento, `bossBlocks`, ataques e roteiro), `src/game.js` (`collide`: tiro em gomo é bloqueado), `src/art-chefes.js` (`serpenteHD(frame)` cabeça 2 quadros, `serpenteGomoHD(frame)` 2 quadros, `serpenteCaudaHD()`), `src/render.js` (gomos da cauda para a cabeça)
- Test: `tests/game.test.js`

**Interfaces:**
- Produces:
  - `b.segments: [{ x, y }]` (10), seguindo o rastro da cabeça a cada 9 unidades
  - `bossBlocks(b, x, y) → boolean` (acertou um gomo)
  - movimento: `x = W/2 + sin(t × 0,9) × (W/2 − 30)`, `y = ty + sin(t × 1,7) × 26`; na fase 2, ×1,5
  - ataques: `gomos` (dura 2,4 s, a cada 0,2 s o gomo `shotI % 10` dispara uma `bala` mirada a 100) e `anel_serpente` (1,2 s, a cada 0,4 s anel de 16 `bolha` a 70 saindo da cabeça)
  - roteiro: fase 1 `["gomos", "pausa", "gomos", "pausa"]`, fase 2 `["gomos", "anel_serpente", "gomos", "anel_serpente"]`

- [ ] **Step 1: escrever os testes que falham**:
  - `"gomos seguem a cabeça mantendo a distância"`: depois de 5 s, distância entre gomos vizinhos dentro de 9 ± 1,5.
  - `"gomos ficam dentro da tela"`: em 30 s, todo gomo com `x` entre 0 e `W` e `y` entre −20 e `H / 2`.
  - `"tiro no gomo é bloqueado; na cabeça dá dano"`.
  - `"todos os roteiros só usam ataques que existem"` (vale para os 6 chefes).
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar e desenhar.**
- [ ] **Step 4: rodar** — `npm test` → PASS; `npm run sprites` e conferir a Serpente em `tests/prints/chefes.png`.
- [ ] **Step 5: commit** ("RAJADA: chefe Serpente").

### Task 14: Forja

**Files:**
- Modify: `src/config.js` (`BOSSES` + `{ id: "forja", name: "Forja", sprite: "forja", hp: 520, score: 9000, y: 0.18, box: [60, 26] }`), `src/bosses.js`, `src/art-chefes.js` (`forjaHD(frame)`, 70×40 no mundo, grade 140×80, 4 quadros de pistões e fornalhas)
- Test: `tests/game.test.js`

**Interfaces:**
- Produces:
  - `ondas`: 2,4 s, a cada 0,8 s uma fileira de `bala` cobrindo a largura com um vão de 28 em `x` sorteado, descendo a 70
  - `brasas`: 2 s, a cada 0,12 s uma `bolha` caindo de `x` sorteado a 80
  - `drones` (fase 2): solta 3 `dardo` em mergulho a partir da Forja (`x − 30`, `x`, `x + 30`), respeitando `PERF.enemies`
  - `rajada_fornalha`: leque de 5 `bala` mirado
  - roteiro: fase 1 `["ondas", "brasas", "pausa", "ondas", "pausa"]`, fase 2 `["ondas", "drones", "brasas", "ondas", "rajada_fornalha"]`; movimento: balanço lateral de ±30

- [ ] **Step 1: escrever os testes que falham**:
  - `"onda de fogo sempre deixa um vão de pelo menos 24"` (50 sementes; maior vão entre tiros vizinhos de uma fileira, contando as bordas, ≥ 24).
  - `"fase 2: o ataque drones solta exatamente 3 dardos"`.
  - `"as ondas respeitam o teto de 220 tiros"`.
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar e desenhar.**
- [ ] **Step 4: rodar** — `npm test` → PASS; conferir a Forja em `tests/prints/chefes.png`.
- [ ] **Step 5: commit** ("RAJADA: chefe Forja").

### Task 15: Rainha

**Files:**
- Modify: `src/config.js` (`BOSSES` + `{ id: "rainha", name: "Rainha", sprite: "rainha", hp: 560, score: 10000, y: 0.22, box: [36, 30] }`), `src/bosses.js`, `src/art-chefes.js` (`rainhaHD(frame)`, 64×44 no mundo, grade 128×88, 4 quadros de asas)
- Test: `tests/game.test.js`

**Interfaces:**
- Produces:
  - `enxame`: 2 s; solta 8 Zangões em V a partir da Rainha, respeitando `PERF.enemies`
  - `ferroes`: 1,6 s, a cada 0,4 s 3 `agulha` miradas a 150
  - `espinhos`: anel de 12 `agulha` a 60
  - `raio_leque` (fase 2, `still: true`): `g.laser(b, a − 0,9, a + 0,9, 1, 1,6)` com `a = g.aimAngle(...)` e largura 6
  - roteiro: fase 1 `["ferroes", "enxame", "pausa", "ferroes", "espinhos", "pausa"]`, fase 2 `["raio_leque", "enxame", "ferroes", "espinhos"]`; movimento em oito
  - com 6 chefes: o setor 7 é Colosso na volta 1

- [ ] **Step 1: escrever os testes que falham**:
  - `"raio em leque sempre avisa por 1 s antes"`.
  - `"enxame não passa do teto de 60 inimigos"`.
  - `"setor 7 é o Colosso na volta 1"` (`makeBoss(6).id === "colosso"`, `lap === 1`).
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar e desenhar.**
- [ ] **Step 4: rodar** — `npm test && npm run build && npm run smoke` → PASS; conferir os 6 chefes em `tests/prints/chefes.png`.
- [ ] **Step 5: commit** ("RAJADA: chefe Rainha; 6 chefes por volta").

## Fase 5: efeitos, metas e coleção

### Task 16: efeitos, sons e câmera lenta

**Files:**
- Modify: `src/game.js` (`g.slowT`, opção `reducedMotion`), `src/main.js` (passa `reducedMotion` ao jogo), `src/render.js` (rastro da faixa 6 em diante, clarão nos canos, cápsula rara com 4 pontos girando, faíscas da lendária, pedaços da armadura com partículas de meio pixel, explosões em cadeia), `src/sprites.js` (`drone` com 3 quadros girando), `src/audio.js` (ajustes de volume dos sons novos)
- Test: `tests/game.test.js`, `tests/smoke.mjs`

**Interfaces:**
- Produces: ao pegar lendária, `g.slowT = 0.3` (tempo real) e, enquanto `g.slowT > 0`, `g.update(dt)` avança o jogo `dt × 0,35`; com `reducedMotion`, nada de câmera lenta.

- [ ] **Step 1: escrever os testes que falham**:
  - `"câmera lenta da lendária dura 0,3 s e a velocidade volta ao normal"`: depois da lendária, três `update(0.1)` avançam `g.t` em 0,035 cada; o quarto avança 0,1.
  - `"com reduzir movimento não há câmera lenta"`.
  - smoke com `reducedMotion: "reduce"`: partida de 20 s sem erro no console; print `tests/prints/efeitos.png` com metralhadora no 40 e uma cápsula lendária.
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar.**
- [ ] **Step 4: rodar** — `npm test && npm run build && npm run smoke` → PASS; conferir `tests/prints/efeitos.png` (rastro, anel, faíscas) e que nenhum clarão grande pisca mais de 3 vezes por segundo.
- [ ] **Step 5: commit** ("RAJADA: rastros, faíscas, câmera lenta e sons de raridade").

### Task 17: recordes, hangar sem fim e missões novas

**Files:**
- Modify: `src/stats.js` (`emptyStats`, `sanitizeStats`, `recordRun`), `src/game.js` (`summary`: `maxDrones`, `bestRarity` 0..3, `bossesBy`, `bossesSeen`), `src/config.js` (`UPGRADES` com `infinite: true` em canhao, foguetes e sorte; `text(n)` para qualquer `n`), `src/progress.js` (`upgradeCost`, `loadoutFor` com `luckLevel`), `src/missions.js`, `src/main.js` (aviso de recorde na hora), `src/ui.js` (`upgradesPanel` sem "MÁX" nas infinitas)
- Test: `tests/meta.test.js`

**Interfaces:**
- Produces:
  - `stats.best` ganha `gun`, `rockets`, `drones`, `rarity` (0..3); `stats.bossKills` (`{ id: n }`) e `stats.bossSeen` (`{ id: true }`)
  - `upgradeCost(key, level)`: depois da tabela, se `infinite`, `Math.round(último × 1,5^(level − costs.length + 1) / 10) × 10`; senão `null`
  - `loadoutFor(profile)`: `gun = ship.gun + canhao`, `rockets = ship.rockets + foguetes` (sem teto), `luck = mult[min(sorte, 3)]`, `luckLevel = sorte`
  - Sorte: `text(n)` = `+15%`, `+30%`, `+50% de cápsulas` até o 3; depois `+50% de cápsulas e mais chance de raras (nível n)`
  - missões: `gun_level_run` ("Chegue ao nível N da metralhadora"), `form_run` ("Chegue à forma {nome}", `n` = nível da forma), `rarity_run` ("Pegue uma cápsula épica" / "lendária", `n` = 2 ou 3), `boss_kill_total` ("Derrote {o chefe}", `type` = id)
  - aviso: na primeira vez na partida que `p.gun` passa de `stats.best.gun`, toast `Recorde: metralhadora nível N`

- [ ] **Step 1: escrever os testes que falham**:

```js
test("save antigo abre sem perder nada", () => {
  const p = sanitizeProfile({ cristais: 500, upgrades: { canhao: 3, sorte: 3 }, stats: { runs: 4, best: { score: 900, sector: 3 } } });
  assert.equal(p.cristais, 500);
  assert.equal(p.upgrades.canhao, 3);
  assert.equal(p.stats.best.score, 900);
  assert.equal(p.stats.best.gun, 0);
  assert.deepEqual(p.stats.bossKills, {});
});
test("hangar sem fim: preço cresce 1,5× depois da tabela", () => {
  assert.equal(upgradeCost("canhao", 3), 1350);
  assert.equal(upgradeCost("canhao", 4), 2030);
  assert.equal(upgradeCost("foguetes", 2), 1130);
  assert.equal(upgradeCost("casco", 2), null);
});
test("Canhão 10 começa no nível 11 e Sorte 6 sobe a raridade", () => {
  const base = defaultProfile();
  const l = loadoutFor({ ...base, upgrades: { ...base.upgrades, canhao: 10, sorte: 6 } });
  assert.equal(l.gun, 11);
  assert.equal(l.luck, 1.5);
  assert.equal(l.luckLevel, 6);
});
test("missões novas têm texto e contam progresso", () => {
  assert.equal(KINDS.form_run.text({ n: 15 }), "Chegue à forma Perfurante");
  assert.equal(KINDS.form_run.value({ maxGun: 15 }), 15);
  assert.equal(KINDS.gun_level_run.text({ n: 22 }), "Chegue ao nível 22 da metralhadora");
  assert.equal(KINDS.rarity_run.text({ n: 3 }), "Pegue uma cápsula lendária");
  assert.equal(KINDS.boss_kill_total.text({ n: 1, type: "rainha" }), "Derrote a Rainha");
});
test("recordes de arma, raridade e chefes entram nas estatísticas", () => {
  const s = recordRun(emptyStats(), run({ maxGun: 22, maxRockets: 9, maxDrones: 4, bestRarity: 3, bossesBy: { rainha: 1 }, bossesSeen: ["rainha"] }), "d");
  assert.equal(s.best.gun, 22);
  assert.equal(s.best.rarity, 3);
  assert.deepEqual(s.bossKills, { rainha: 1 });
  assert.equal(s.bossSeen.rainha, true);
});
```

- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar** (o diretor e o loot passam a receber `luckLevel` do loadout).
- [ ] **Step 4: rodar** — `npm test` → PASS.
- [ ] **Step 5: commit** ("RAJADA: recordes de arma, hangar sem fim e missões novas").

### Task 18: Coleção

**Files:**
- Modify: `index.html` (botão `#btn-collection` "Coleção" na tela inicial e overlay `#collection`), `src/ui.js` (`collectionData(profile)` e `collectionPanel(data, iconUrl)`), `src/main.js` (abrir, fechar, desenhar), `style.css`
- Test: `tests/meta.test.js`, `tests/smoke.mjs`

**Interfaces:**
- Consumes: Tarefa 17 (`bossKills`, `bossSeen`, `best.gun/rockets/drones`).
- Produces: `collectionData(profile) → { bosses: [{ id, name, seen, kills }], forms: { gun: [{ name, at, unlocked }], rockets: [...], drones: [...] } }` (forma liberada quando o recorde da arma alcança o nível dela; foguetes e drones usam `ROCKET_MARKS` e `DRONE_MARKS`).
- Tela: chefe nunca visto aparece como silhueta (filtro de brilho zero) com "???"; formas bloqueadas mostram só o nível ("Nível 25").

- [ ] **Step 1: escrever os testes que falham**:
  - `"coleção: chefe não visto é silhueta; forma liberada pelo recorde"` (perfil com `bossSeen { colosso: true }`, `best.gun 16` → Colosso visto, Aranha não; Perfurante liberada, Caçadora não).
  - smoke: abrir a Coleção pela tela inicial, todos os botões com 44 px ou mais, print `tests/prints/colecao.png`.
- [ ] **Step 2: rodar e ver falhar** — FAIL.
- [ ] **Step 3: implementar.**
- [ ] **Step 4: rodar** — `npm test && npm run build && npm run smoke` → PASS.
- [ ] **Step 5: commit** ("RAJADA: coleção de chefes e formas").

## Fase 6: balanceamento, desempenho e publicação

### Task 19: balanceamento com bots

**Files:**
- Modify: `tests/balance.mjs` (colunas novas: nível de metralhadora mediano e máximo; inimigos/min no setor 1; modo `-- longo`: piloto 0.9, 20 partidas, limite de 60 min, mostra a porcentagem que acabou antes do setor 30), valores de ajuste em `src/config.js`
- Ajustar só: `POWER.perLevel`, `LOOT.sources`, `DROPS`, vida base dos chefes, `ELITE`. Não mudar o que foi aprovado na especificação (vida +35% por setor, setor 1 com limite 18, elites a partir do setor 4).

- [ ] **Step 1: rodar** — `npm run balance -- 30` e `npm run balance -- longo`; anotar os números.
- [ ] **Step 2: comparar com os critérios**: S4 (inimigos/min no setor 1 ≥ 1,8× a base da Tarefa 7), S7 (95% das partidas do piloto 0.9 acabam antes do setor 30), S8 (piloto 0.3: mediana ≥ 3 min; piloto 0.6: mediana entre 8 e 14 min), S9 (piloto 0.6: nível mediano de metralhadora ≥ 10).
- [ ] **Step 3: ajustar e repetir** até os 4 critérios passarem; `npm test` → PASS.
- [ ] **Step 4: commit** com a tabela final no corpo da mensagem ("RAJADA: balanceamento da evolução infinita").

### Task 20: desempenho

**Files:**
- Create: `tests/perf.mjs` (Playwright: CPU 4× mais lenta via `Emulation.setCPUThrottlingRate`; pior caso pelos ganchos de QA: `jumpTo(12)`, chefe na fase 2, metralhadora 40, foguetes 20, drones 12; mede quadros por segundo por 10 s)
- Modify: `package.json` (script `"perf": "node tests/perf.mjs"`), `src/main.js` (`window.__rajada.spriteMs` com o tempo de `buildSprites`)

- [ ] **Step 1: escrever o script** que imprime `fps médio`, `pior segundo` e `spriteMs`, e sai com erro se `fps médio < 58` ou `spriteMs > 300` (critério S10).
- [ ] **Step 2: rodar** — `npm run build && npm run perf`.
- [ ] **Step 3: se falhar**, cortar custo (menos partículas, rampas dos tiros em cache como canvas pequenos, gomos e variações pré-desenhados) e repetir até passar.
- [ ] **Step 4: commit** ("RAJADA: medição de desempenho no pior caso").

### Task 21: documentação, versão 1.1.0 e publicação

**Files:**
- Modify: `docs/design.md` (armas, loot, dificuldade, chefes, tabela de balanceamento da Tarefa 19, auditoria técnica com testes e desempenho), `README.md`, `docs/lancamento.md` (descrição das lojas: 6 chefes, armas sem limite), `package.json` (`"version": "1.1.0"`), `store/` (`npm run store` refaz as capturas)

- [ ] **Step 1: atualizar os textos e a versão.**
- [ ] **Step 2: rodar tudo** — `npm test && npm run build && npm run smoke && npm run perf && npm run sprites && npm run store` → tudo ok.
- [ ] **Step 3: commit e push** ("RAJADA 1.1: evolução infinita, loot com raridade e 6 chefes"); CI verde no GitHub (site, APK e iPhone).
- [ ] **Step 4: publicar** — deploy de produção na Vercel (`rajada-jogo`) a partir do commit; republicar a prévia no Claude a partir de `dist/artifact.html`; rodar o workflow `Jogo RAJADA` para atualizar o APK de teste; mandar `tests/prints/chefes.png` e `tests/prints/armas.png` ao dono.
