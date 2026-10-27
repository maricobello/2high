# RAJADA: evolução infinita, loot com raridade e chefes em alta definição

- Data: 27 de outubro de 2026
- Situação: design aprovado em conversa (3 partes); esta especificação aguarda revisão
- Escopo: só o jogo em `rajada/`

## 1. Objetivo

Pedido do dono do jogo, nas palavras dele resumidas:

1. As evoluções das armas estão limitadas: quer arma sem nível máximo.
2. Tiros que mudam de cor e armas que continuam evoluindo mesmo depois de muitos upgrades.
3. Mais animações e chefes em alta definição, mantendo o pixel art.
4. Loot bem estruturado e infinito.
5. Mais inimigos já no começo.
6. Inimigos mais resistentes a cada fase.
7. Muito envolvente, para a pessoa continuar jogando.

Decisões tomadas na conversa:

- Alta definição só nos chefes e nos inimigos grandes (Couraçado, Portador, pedra
  grande). O resto mantém o pixel de hoje.
- Evolução das armas por marcos a cada 5 níveis (sem fusões de armas nesta etapa).
- Poder sem fim dentro da partida; cada partida recomeça do básico mais o hangar.
- Hangar sem fim em Canhão, Foguetes e Sorte.
- Setor 1 com cerca do dobro de inimigos; vida +35% por setor; elites a partir do
  setor 4.
- 6 chefes: os 3 atuais redesenhados e 3 novos (Serpente, Forja, Rainha).
- Coleção (galeria) de chefes e formas de arma.
- Continua sem pagar para ganhar e sem caixas de recompensa pagas (ECA Digital,
  Lei 15.211/2025).

### Critérios de sucesso

| # | Critério | Como verificar |
|---|---|---|
| S1 | Nenhuma cápsula de arma vira "máximo"; nível sem teto | teste: nível 200 funciona e o dano cresce a cada nível |
| S2 | Forma nova nos níveis 5, 10, 15, 20, 25 e 30; uma ★ a cada 5 níveis a partir do 35 | teste das tabelas |
| S3 | Cor do tiro muda a cada 5 níveis (11 faixas) e vira arco-íris no 50 | teste + folha de sprites |
| S4 | Setor 1 com pelo menos 1,8× os inimigos por minuto de hoje | `npm run balance` antes e depois |
| S5 | Vida dos inimigos +35% por setor; elites a partir do setor 4 | teste de `sectorScale` e das ondas |
| S6 | 6 chefes em alta definição, cada um com animação própria e armadura que quebra na fase 2 | prints dos 6 chefes |
| S7 | Partidas não ficam eternas: 95% das partidas do bot experiente acabam antes do setor 30 | `npm run balance` |
| S8 | Primeira partida de iniciante dura 3 min ou mais (hoje 2 min 55 s); jogador médio de 8 a 14 min (hoje 8 min 46 s) | `npm run balance` |
| S9 | Jogador médio vê pelo menos 2 formas de metralhadora por partida (nível 10 ou mais na mediana) | `npm run balance` |
| S10 | 60 quadros por segundo com CPU 4× mais lenta, no pior caso (chefe na fase 2, tela cheia de tiros) | medição no navegador |
| S11 | Saves antigos continuam abrindo, sem perder progresso | teste de `sanitizeProfile` |

### Fora do escopo

Fusões de armas, versão em inglês, monetização, alta definição da nave do jogador,
dos inimigos pequenos e dos tiros (só as cores mudam), modo para dois jogadores.

## 2. Armas sem teto (`src/weapons.js`, `src/config.js`)

### 2.1 Regras gerais

- Toda arma tem nível de 0 (ou 1, na metralhadora) até infinito.
- Dano multiplicado por `1 + 0,10 × (nível − 1)` (cresce sempre, sem teto).
- Faixa de cor: `faixa = min(10, floor(nível / 5))`, trocando junto com cada marco
  (5, 10, 15...), nesta ordem: branco (níveis 1 a 4), amarelo, laranja, vermelho,
  rosa, violeta, azul, ciano, verde, dourado (45 a 49). Do nível 50 em diante (faixa
  10), arco-íris animado (troca de matiz, sem piscar claro e escuro).
- Estrelas: a partir do nível 35, uma ★ a cada 5 níveis (35 = 1★, 40 = 2★...),
  cada uma com +15% de dano além do linear.
- Tetos técnicos (legibilidade e desempenho): no máximo 9 canos por rajada, 8
  foguetes por salva e 4 drones. Poder além disso vira dano, tamanho e cadência.

### 2.2 Metralhadora

| Nível | Forma | O que muda |
|---|---|---|
| 1 a 4 | Rajada | 1, 2, 3 e 4 canos (como hoje) |
| 5 | Leque | 5 canos abertos |
| 10 | Pesada | tiros grandes (dano ×1,4) e 7 canos |
| 15 | Perfurante | cada tiro atravessa 1 inimigo |
| 20 | Caçadora | os 2 canos de fora curvam atrás do inimigo mais perto |
| 25 | Raio | o cano do meio vira um feixe contínuo que atravessa tudo |
| 30 | Tempestade | rajadas alternam um leque em espiral; 9 canos |
| 35+ | Estelar | +1★ a cada 5 níveis; brilho e rastro maiores |

- Cadência: de 0,125 s (nível 1) até 0,075 s (nível 30), sem baixar mais depois.
- Funções: `gunForm(nível)`, `gunVolley(nível, x, y, volley)` devolve tiros com
  `{x, y, vx, vy, dmg, big, pierce, homing, faixa}`; `gunBeam(nível)` devolve
  `null` ou `{largura, dps, faixa}`; `gunInterval(nível, turbo)`.

### 2.3 Foguetes

| Nível | O que muda |
|---|---|
| 1 a 4 | como hoje (1, 2, 2 mais rápidos, 4) |
| 5 | 6 por salva |
| 10 | 8 por salva |
| 15 | fragmentação: ao explodir, solta 4 estilhaços que acertam em volta |
| 20+ | explosão 10% maior a cada 5 níveis (até 2×) e dano crescente |

`rocketSpec(nível, turbo)` devolve `{every, count, dmg, splash, splashDmg, frag, faixa}`.

### 2.4 Drones

| Nível | O que muda |
|---|---|
| 1 a 4 | 1 a 4 drones |
| 5+ | cadência 5% maior por nível (até 2×) e dano crescente |
| 10 | cada drone dispara um raio curto em vez de tiros |

`droneSpec(nível)` devolve `{count, every, dmg, beam, faixa}`.

### 2.5 Mecânicas novas na partida (`src/game.js`)

- Perfurante: o tiro guarda quantos inimigos ainda atravessa e quem já acertou
  (não acerta o mesmo duas vezes).
- Caçadora: tiro teleguiado reaproveita a lógica dos foguetes (`steerRocket`),
  escolhe alvo a cada 0,25 s, curva no máximo 6 rad/s, vida de 1,2 s.
- Raio: retângulo vertical da nave até o topo; a cada 0,1 s dá dano a todos os
  inimigos (e ao chefe) dentro da largura; faíscas onde encosta.
- Ao levar dano, a arma de maior nível perde 1 nível (empate: metralhadora).
  A regra de recuperação de hoje (peso maior para a arma perdida) continua.

## 3. Loot com raridade (`src/drops.js`, `src/config.js`)

### 3.1 Raridades

| Raridade | Cor | Arma (M, F, D) | Suporte (E, H, P) |
|---|---|---|---|
| Comum | a de hoje | +1 nível | efeito normal |
| Rara | azul | +2 níveis | efeito + 20 de TURBO |
| Épica | roxa | +3 níveis | efeito + 1 nível em todas as armas |
| Lendária | dourada | até o próximo marco (mínimo +3) | efeito + 1 nível em todas + TURBO cheio |

### 3.2 Chance por origem (valores iniciais, ajustados pelos bots)

| Origem | Comum | Rara | Épica | Lendária |
|---|---|---|---|---|
| Inimigo comum | 88% | 11% | 1% | 0% |
| Portador | 60% | 35% | 5% | 0% |
| Elite | 30% | 50% | 18% | 2% |
| Couraçado | 0% | 70% | 27% | 3% |
| Chefe, 1ª cápsula | 0% | 0% | 85% | 15% |
| Chefe, 2ª cápsula | 30% | 50% | 20% | 0% |

- Garantia contra azar: depois de 6 comuns seguidas, a próxima é rara ou melhor;
  se 2 chefes seguidos passarem sem lendária, o terceiro solta uma (pelo menos uma
  lendária a cada 3 chefes).
- Sorte do hangar: cada nível tira 2 pontos percentuais da comum e distribui entre
  as outras (até a comum chegar a 40% no inimigo comum).
- O tipo da cápsula (M, F, D, E, H, P) continua sorteado por `pickCapsule`, sem o
  peso reduzido de arma "no máximo" (não existe mais máximo).
- Função nova: `rollRarity(origem, ctx, rng)`; `applyCapsule(p, tipo, raridade)`
  devolve `{ganho, nível, forma}` com a forma nova quando passa de um marco.
- Os sorteios são gratuitos, só dentro do jogo: não há compra de item aleatório.

## 4. Inimigos e dificuldade (`src/config.js`, `src/waves.js`, `src/enemies.js`, `src/director.js`)

- `sectorScale(n)`:
  - vida: `1 + 0,35 × (n − 1)`, sem teto;
  - limite de inimigos na tela: 18 no setor 1, +5 por setor, até 60;
  - intervalo entre ondas: 1,4 s no setor 1, caindo até 0,6 s;
  - velocidade e cadência dos tiros inimigos mantêm teto (1,6× e 3×).
- Ondas do começo maiores: "enxame" (8 a 12 Zangões), fila de 8, V de 9.
- Primeira partida: 3 s de calma para a dica de arrastar, depois ondas normais.
- Elites (a partir do setor 4): chance de 8% por inimigo, +2 pontos por setor,
  até 30%. Vida ×3, contorno dourado na primeira volta e na cor da volta depois,
  cristais ×2, loot da origem "Elite".
- `SECTORS` ganha um 6º cenário (Núcleo, em dourado e laranja escuros), para
  cenário e chefe andarem juntos: cada volta tem 6 setores e 6 chefes, e o nome do
  setor ganha II, III... a cada volta.
- Voltas (a cada 6 setores): inimigos e chefes trocam de paleta (carmesim, dourado,
  sombra, e depois repete com mais brilho) e um tipo de inimigo ganha um ataque:
  volta 1, Atirador dispara leque de 3; volta 2, Couraçado dispara anel; volta 3,
  Mina explode em tiros; depois continuam acumulados.
- O diretor de ritmo deixa de usar `GUN_MAX`; a "arma forte" passa a ser medida
  pelo dano por segundo estimado da nave dividido pela vida média do setor.
- Tetos de desempenho: 60 inimigos, 220 tiros inimigos e 260 tiros da nave.

## 5. Chefes (`src/bosses.js`, `src/config.js`)

Ordem: Colosso, Aranha, Olho, Serpente, Forja, Rainha; depois a volta seguinte
recomeça com paleta nova, mais vida e ataques mais rápidos (lógica `lap` de hoje).
Vida: base × `sectorScale(n).hp` × bônus da volta.

| Chefe | Animação | Fase 1 | Fase 2 (abaixo de 50%) |
|---|---|---|---|
| Colosso | motores pulsando, torretas girando | leque, gêmeos, torretas | armadura cai, espiral e anel |
| Aranha | patas andando (4 quadros) | teia, bote | carapaça racha, teia6 e chuva |
| Olho | pupila segue a nave, pálpebras piscam | olhar, laser | íris rachada, laser duplo e orbes |
| Serpente (novo) | corpo em 10 gomos que serpenteia | gomos atiram em ordem | anda mais rápido e fecha um anel de tiros |
| Forja (nova) | pistões e fornalhas | ondas de fogo com vão, chuva de brasas | casco quebra, lança 3 drones e acelera as ondas |
| Rainha (nova) | asas batendo | chama enxames de Zangões, ferrões mirados | coroa quebra, raio em leque que varre a tela (com aviso) |

- Serpente: a cabeça é o ponto fraco; os gomos seguem o caminho da cabeça e
  bloqueiam tiros.
- Armadura que quebra: evento `boss_phase` dispara os pedaços (partículas em alta
  definição) e troca o sprite inteiro pelo quebrado.
- Entrada com alerta e nome (como hoje); derrota com explosões em cadeia, chuva de
  cristais e as 2 cápsulas (tabela da seção 3.2).

## 6. Desenho em alta definição (`src/render.js`, `src/sprites.js`)

- O canvas passa a ter o dobro de pixels por dentro (`RES = 2`): 448 de largura.
  O mundo continua em 224 unidades; `ctx.setTransform(2, 0, 0, 2, 0, 0)` desenha
  tudo como hoje.
- Sprites com `hd: true` têm o dobro de detalhe e são desenhados com metade do
  tamanho em pixels de canvas (cada pixel do sprite vale meio pixel do mundo).
  Usados nos 6 chefes, no Couraçado, no Portador e na pedra grande.
- Editor de pixels em código ganha ferramentas para alta definição: sombra em 3
  tons (luz em cima à esquerda, base, sombra embaixo à direita), brilho na borda,
  pontilhado na transição e peças separadas por quadro (para animar e quebrar).
- Variações geradas no início (não desenhadas à mão): tiros nas 11 cores e 6
  tons de arco-íris, cápsulas por raridade, contornos de elite e paletas das voltas.
- Orçamento: `buildSprites` em até 300 ms num celular modesto simulado.
- `npm run sprites` passa a gerar também `tests/prints/chefes.png` com os 6 chefes
  e as duas fases.

## 7. Efeitos e tela (`src/render.js`, `src/main.js`, `src/audio.js`, `style.css`)

- Forma nova: anel de luz na cor da faixa em volta da nave e o nome da forma no
  centro da tela por 1,2 s; som próprio.
- Tiros da faixa 6 em diante deixam rastro; arco-íris troca de matiz a cada 0,1 s.
- Clarão nos canos, fumaça nos foguetes, drones girando.
- Cápsulas raras giram e brilham na cor da raridade; a lendária solta faíscas e
  dá 0,3 s de câmera lenta.
- Sons novos: rara, épica, lendária e forma nova.
- "Reduzir movimento" desliga câmera lenta, rastro e tremores; nenhum clarão de
  área grande mais de 3 vezes por segundo.
- Placar: cada arma mostra nível na cor da faixa e as estrelas; abaixo, uma barra
  "faltam N para PERFURANTE" (próximo marco da metralhadora; depois do 35, para a
  próxima ★).
- Aviso na hora ao bater o recorde de nível de arma.
- Tela "Coleção" (botão na tela inicial): os 6 chefes (silhueta se nunca visto,
  quantas vezes derrotado) e as formas de cada arma (bloqueada ou liberada, com o
  nível em que aparece).

## 8. Progresso, missões e estatísticas (`src/progress.js`, `src/stats.js`, `src/missions.js`)

- Hangar sem fim em Canhão, Foguetes e Sorte: depois da tabela de hoje, cada nível
  custa 1,5× o anterior (arredondado para dezenas). Canhão: começa no nível
  `1 + n`; Foguetes: começa no nível `n`; Sorte: os níveis 1 a 3 continuam dando
  +15%, +30% e +50% de cápsulas, e todo nível também melhora a raridade (seção
  3.2). Os outros mantêm o máximo de hoje.
- `loadoutFor` sem `GUN_MAX` e `ROCKETS_MAX`.
- Estatísticas novas: recorde de nível de cada arma, melhor raridade pega,
  derrotas por chefe, formas liberadas por arma. `sanitizeProfile` preenche os
  campos que faltam (saves antigos abrem normalmente).
- Missões novas: "Chegue ao nível N da metralhadora", "Chegue à forma X",
  "Pegue uma cápsula épica" (ou lendária), "Derrote a Rainha" (ou outro chefe).
  O valor de N segue a regra de hoje (percentil 65 das últimas partidas).

## 9. Testes e balanceamento

- Testes de regras (`node --test`):
  - armas: nível 200, formas e estrelas nos níveis certos, faixas de cor, tetos de
    canos, foguetes e drones, dano sempre crescente;
  - loot: distribuição por origem (10 mil sorteios com semente fixa, tolerância de
    1 ponto percentual), garantias, efeito da Sorte, `applyCapsule` com raridade;
  - dificuldade: `sectorScale`, ondas do setor 1, elites só a partir do setor 4;
  - chefes: 6 na ordem certa, paleta por volta, cada ataque dispara dentro dos
    tetos, gomos da Serpente seguem a cabeça, troca de sprite na fase 2;
  - progresso: preço do hangar sem fim, `loadoutFor` sem teto, saves antigos.
- Bots (`npm run balance`): relatório com duração, setor, nível de arma por
  partida e inimigos por minuto no setor 1; critérios S4, S7, S8 e S9.
- Navegador: `npm run smoke` no computador e no celular sem erro no console;
  folha de sprites e prints dos chefes; medição de quadros por segundo (S10).
- Atualizar `docs/design.md` (armas, loot, curva, auditoria) e o texto das lojas.

## 10. Riscos

| Risco | Cuidado |
|---|---|
| Celular fica lento com canvas 2× e mais tiros | tetos da seção 4, medição S10 antes de publicar |
| Poder infinito deixa o jogo fácil demais (ou difícil) | vida +35% por setor, elites e voltas; bots definem os números finais |
| Arte dos 6 chefes toma muito tempo | editor de pixels em código; prints para revisão antes de publicar |
| Saves antigos quebram | campos novos com valor padrão e teste de compatibilidade |

## 11. Ordem de entrega

1. Armas sem teto, loot com raridade e barra de próxima forma (jogável sozinho).
2. Dificuldade: começo cheio, +35% por setor, elites e voltas.
3. Canvas 2× e alta definição dos inimigos grandes.
4. Chefes: 3 redesenhados e 3 novos, com fase 2 e armadura quebrando.
5. Efeitos, sons, missões, recordes e coleção.
6. Balanceamento com bots, testes, prints, desempenho, documentação e publicação
   (site, prévia no Claude e APK).
