# RAJADA: design e auditoria das mecânicas

Nave retrô de rolagem vertical, jogada com um dedo. A nave atira sozinha; você
arrasta para desviar e mirar. Inimigos descem a tela sem parar, cápsulas dão
upgrades na hora (mais metralhadoras, foguetes teleguiados, drones, escudo) e
cada setor termina com um chefe. Entre as partidas, os cristais coletados
compram melhorias permanentes no hangar.

Na versão 1.1 ("evolução infinita") as armas não têm mais nível máximo: a
metralhadora troca de forma a cada 5 níveis e o tiro muda de cor; as cápsulas
têm raridade; os inimigos ficam mais resistentes a cada setor; e são 6 chefes
em alta definição, que voltam com paleta nova a cada volta.

"Rajada" é a sequência de tiros da metralhadora. O lema "Só mais uma rajada"
é o sentimento que o jogo quer provocar: só mais uma partida.

## Objetivo

- Simples de entender em 5 segundos: arrastar, desviar, pegar cápsula.
- Viciante "do jeito bom": a pessoa volta porque sente que está ficando mais
  forte e melhor, não por punição, energia, anúncio ou compra.
- Inteligente: o jogo coleta dados da própria partida, no aparelho, e usa
  esses dados para manter a pessoa no "fluxo" (nem fácil, nem frustrante).
- Uma base de código para site (PWA), iPhone e Android (Capacitor).

## O loop

1. A partida começa em menos de 1 segundo. A nave atira sozinha.
2. Ondas de inimigos descem. Destruir enche o combo (×2 a ×8) e solta cristais.
3. Cápsulas sobem o nível das armas na hora. Levar tiro tira 1 de casco e
   1 nível de arma (o escudo absorve um tiro).
4. A cada setor (cerca de 1 minuto) vem um chefe. Vencer libera o próximo
   setor, mais difícil e com outra cor.
5. Ao cair: resumo com recorde, missões e cristais; um toque recomeça.
6. Cristais compram melhorias permanentes; missões sobem a patente; marcos
   liberam naves novas.

Partidas de alguns minutos; quem joga bem passa dos 10. Primeira partida
desenhada para chegar ao primeiro chefe com armas fortes (o momento "uau" no
primeiro minuto), com 3 s de calma para a dica de arrastar.

## Armas (durante a partida)

| Cápsula | Letra e cor | Efeito |
|---|---|---|
| Metralhadora | M, amarela | sobe o nível: mais canos, cadência e dano; forma nova a cada 5 níveis |
| Foguetes | F, laranja | foguetes teleguiados com explosão; salva maior e estilhaços nos marcos |
| Drone | D, verde | até 4 naves de apoio; do nível 10 em diante atiram um raio fino até o alto da tela |
| Escudo | E, azul | absorve um tiro |
| Reparo | coração, rosa | +1 de casco |
| Pulso | estrela, violeta | limpa os tiros da tela e fere todos os inimigos |

**Sem nível máximo.** Toda arma sobe para sempre; o dano cresce 2% por nível
e, do 35 em diante, cada 5 níveis dão uma ★ (+15% de dano). O que tem teto é só
a quantidade na tela (9 canos, 8 foguetes, 4 drones), pela legibilidade.

| Nível | Forma da metralhadora |
|---|---|
| 1 a 4 | Rajada: 1 a 4 canos |
| 5 | Leque: 5 canos abertos |
| 10 | Pesada: tiros grandes e 7 canos |
| 15 | Perfurante: cada tiro atravessa um inimigo |
| 20 | Caçadora: os 2 canos de fora curvam atrás do alvo |
| 25 | Raio: o cano do meio vira um feixe que atravessa tudo |
| 30 | Tempestade: 9 canos, o leque balança de um lado para o outro |
| 35+ | Estelar: uma ★ a cada 5 níveis, rastro maior |

Foguetes: 6 por salva no 5, 8 no 10, estilhaços no 15, explosão maior a cada 5
níveis depois. Drones: 4 no nível 4 (Esquadrilha), raios no 10.

**Cor do tiro:** muda a cada 5 níveis (branco, amarelo, laranja, vermelho, rosa,
violeta, azul, ciano, verde, dourado) e vira arco-íris no 50. O placar mostra o
nível de cada arma na cor dela e uma barra "faltam N para PERFURANTE" (depois do
35, para a próxima ★). Forma nova aparece grande no centro da tela, com som.

**Raridade das cápsulas:**

| Raridade | Arma (M, F, D) | Suporte (E, H, P) |
|---|---|---|
| Comum | +1 nível | o efeito |
| Rara (azul) | +2 níveis | o efeito e +20 de TURBO |
| Épica (roxa) | +3 níveis | o efeito e +1 em todas as armas |
| Lendária (dourada) | até o próximo marco (mínimo +3) | o efeito, +1 em todas e TURBO cheio |

A chance depende de quem solta. Cápsulas comuns: 88% das de inimigo comum, 60%
das do Portador, 30% das de elite e nenhuma das do Couraçado e da 1ª cápsula do
chefe. Garantias contra azar: depois de 6 comuns seguidas vem rara ou melhor; a
cada 3 chefes, pelo menos uma lendária. Rara ou melhor brilha com anel e pontos
girando; a lendária solta faíscas e dá 0,3 s de câmera lenta. Com o TURBO já
ligado, o bônus de TURBO da cápsula estica o tempo dele (a lendária volta a
encher). Os sorteios são só dentro do jogo: não há compra de item aleatório.

**TURBO:** destruir inimigos e raspar nos tiros inimigos enche a barra do
TURBO. Cheia, ela dispara sozinha: 6 segundos de tiro dobrado, pontos em dobro
e música acelerada. Sem botão extra.

**Raspão:** tiro inimigo que passa muito perto da nave sem acertar vale pontos
e enche o TURBO. A área que machuca é só o centro da nave (3 px): passar raspando
é possível e dá a sensação de "por um triz".

## Inimigos e chefes

| Inimigo | Papel |
|---|---|
| Zangão | bucha de canhão, em fila, V, serpente ou enxame de 8 a 12 |
| Dardo | para, pisca e mergulha na sua direção |
| Atirador | para no alto e atira mirando em você |
| Couraçado | grande e lento, leque de tiros; sempre solta cápsula |
| Pedra | asteroide que se parte em pedaços menores |
| Mina | explode em anel de tiros quando destruída |
| Portador | brilha e cruza a tela; destruído, solta cápsula |

O começo é cheio (o dobro de inimigos por minuto da 1.0) e cada setor deixa os
inimigos 35% mais resistentes, sem teto; a cada volta, a vida dos inimigos comuns
ainda é multiplicada por 1,85, para acompanhar o dano das armas sem teto. Do
setor 4 em diante aparecem **elites** (8%, crescendo até 50%): contorno dourado,
vida ×3, cristais em dobro e loot melhor.

**Seis chefes**, em alta definição (o dobro de pixels, com volume, brilho e
animação): **Colosso** (leques, gêmeos, torretas e espirais), **Aranha** (teias,
bote e chuva), **Olho** (laser com aviso, tesoura de feixes e orbes), **Serpente**
(10 gomos que seguem a cabeça e bloqueiam tiros; só a cabeça leva dano),
**Forja** (ondas de fogo com um único vão, chuva de brasas, lança dardos) e
**Rainha** (ferrões, enxames e um raio que varre em volta da nave depois de 1 s
de aviso). Abaixo de 50% de vida a
armadura quebra (placas arrancadas e rachaduras) e o padrão muda.

**Voltas:** os 6 setores (Órbita Baixa, Cinturão, Nebulosa, Fronteira, Abismo e
Núcleo) e os 6 chefes formam uma volta. Da 2ª volta em diante (setor 7, "Órbita
Baixa II") inimigos e chefes trocam de paleta a cada volta (carmesim, dourado,
sombra; depois repete com mais brilho), os chefes ficam mais fortes e já começam
no padrão da fase 2, e um inimigo ganha um ataque que fica: Atirador com leque de
agulhas (2ª volta), Couraçado com anel (3ª), Mina com agulhas a mais (4ª).

Tetos de desempenho: 60 inimigos, 220 tiros inimigos e 260 tiros da nave.

## O Diretor: dados da partida a serviço do fluxo

Um "Diretor" (como o de Left 4 Dead) decide o ritmo das ondas em tempo real.

| Dado medido | O que o Diretor faz |
|---|---|
| Ciclo de tensão do setor | sobe a pressão por ~15 s, pico de ~6 s, alívio de ~4 s, repete |
| Dano recente | segura ondas novas por 1,5 s (misericórdia) |
| Casco em 1 | reduz a pressão e aumenta a chance de Reparo |
| Muito tempo sem dano, armas fortes (dano por segundo ≥ 3× a vida média do setor) | aumenta a pressão (desafio) |
| Tempo sem cápsula | chance de cápsula cresce a cada segundo (garantia contra azar) |
| Arma perdida num dano | a mesma arma tende a voltar logo (recuperação) |
| Muitos tiros na tela e casco baixo | chance de Pulso |

Entre partidas, o jogo calcula uma **habilidade estimada** (média móvel dos
setores alcançados e do tempo de voo). Ela ajusta, em no máximo ±20%, a
pressão inicial, a velocidade dos tiros inimigos e as cápsulas do começo.
Quem está aprendendo ganha um começo mais gentil; quem domina chega mais
rápido à parte boa. Três quedas seguidas antes do primeiro chefe deixam a
partida seguinte um pouco mais generosa, sem avisar.

## Missões adaptativas

Sempre 3 missões ativas. O alvo de cada uma sai das estatísticas do próprio
jogador (perto do percentil 60-70 do que ele já fez), então é alcançável em
1 a 3 partidas.

| Dado | Missão gerada |
|---|---|
| Abates por partida | "Destrua N inimigos em uma partida" |
| Melhor setor | "Chegue ao setor S" |
| Inimigo que mais te derrubou | "Destrua N atiradores" (vira meta o que frustrava) |
| Arma pouco usada | "Destrua N inimigos com foguetes" (ensina variedade) |
| Melhor combo | "Faça um combo ×M" |
| Nave liberada e nunca usada | "Jogue uma partida com a Vespa" |
| Raspões | "Raspe em N tiros inimigos" |
| Recorde da metralhadora | "Chegue ao nível N da metralhadora", "Chegue à forma Perfurante" |
| Melhor cápsula | "Pegue uma cápsula épica" / "lendária" |
| Chefe visto e ainda não derrotado | "Derrote a Rainha" |

Cada 3 missões sobem a patente (Cadete, Aspirante, Piloto, Tenente, Capitão...).
Cada patente dá +5% de cristais (até +50%).

## Hangar (entre partidas)

| Melhoria | Efeito |
|---|---|
| Casco | +1 de casco máximo (2 níveis) |
| Canhão | começa com a metralhadora 1 nível acima, sem nível máximo |
| Ímã | puxa cristais de mais longe (4 níveis) |
| Escudo | começa com escudo; nos níveis 2 e 3 ele volta sozinho |
| Sorte | mais cápsulas até o 3; depois, mais chance de raras, sem nível máximo |
| Foguetes | começa com foguetes, sem nível máximo |

Nas melhorias sem teto o preço segue a tabela e depois cresce 1,5× por nível.
A partida avisa na hora quando a metralhadora passa do seu recorde de nível.

**Coleção** (botão na tela inicial): os 6 chefes (silhueta e "???" se nunca
vistos, quantas vezes derrotados) e as formas de cada arma, liberadas pelo
recorde de nível.

Naves liberadas por marcos, não por compra: **Faísca** (equilibrada),
**Vespa** (rápida, centro menor, menos casco; setor 3), **Bigorna** (mais
casco, começa com drone; 5 chefes) e **Cometa** (começa com foguetes;
12 missões).

## Auditoria: o que deixa o jogo viciante e como o RAJADA aplica

| Mecanismo | Por que prende | Como está no jogo |
|---|---|---|
| Loop curtíssimo | Custo de tentar de novo perto de zero. | Um toque recomeça; nada de carregamento. |
| Poder crescente | Fantasia de poder: ver a nave ficar forte. | Armas sem teto: forma nova a cada 5 níveis, cor do tiro que muda, estrelas depois do 35. |
| Recompensa variável | Cápsulas e cristais imprevisíveis atraem atenção. | Raridade das cápsulas com garantia contra azar (rara depois de 6 comuns, lendária a cada 3 chefes). |
| Quase-acerto | Errar por pouco é lido como "eu consigo". | Raspão premiado; tela final mostra quanto faltou para o recorde e para cada missão. |
| Recuperação | Esperança de virar o jogo. | Arma perdida tende a voltar; misericórdia do Diretor; TURBO. |
| Combo sonoro | Melodia que sobe cria vontade de não quebrar a sequência. | Cristais seguidos tocam notas de uma escala pentatônica que sobe. |
| Metas à vista | Quanto mais perto da meta, mais esforço (goal gradient). | Barra do setor até o chefe; "faltam 3 para PERFURANTE"; "faltam 23 cristais para o Ímã 2". |
| Novidade em doses | O cérebro quer ver o que vem depois. | 6 chefes em alta definição, voltas com paleta nova, elites, Coleção com silhuetas a descobrir. |
| Progresso permanente | Mesmo partida ruim rende algo. | Cristais e missões sempre avançam. |
| Desafio sob medida | Fluxo: dificuldade perto da habilidade. | Diretor + habilidade estimada + missões no percentil do jogador. |
| Juice | Resposta forte a cada ação dá prazer físico. | Explosões em pixels, tremor, flash de dano, pausa de impacto, vibração, música chiptune. |
| Volta diária gentil | Motivo para voltar sem castigo. | Primeira partida do dia vale cristais em dobro; sem sequência que se perde. |

### Limites éticos ("do jeito bom")

- Sem energia, vidas ou espera para jogar.
- Sem anúncios, compras ou caixas de recompensa pagas.
- Sem sequência diária que pune quem some.
- Pausa automática ao sair do app; respeita "reduzir movimento".
- Sem flashes de tela inteira piscando (fotossensibilidade): chefes e inimigos
  grandes atingidos ganham um brilho translúcido no máximo 3 vezes por segundo.
- Depois de 45 minutos seguidos, a tela final sugere uma pausa.
- Os dados ficam no aparelho. Envio de estatísticas anônimas só existe se o
  dono do jogo configurar um endereço no build, e mesmo assim só com o
  consentimento do jogador (desligado por padrão).

## Visual e som

- Pixel art em baixa resolução (224 px de largura, ampliada sem borrar), paleta
  própria de 32 cores. Todos os sprites e ícones são desenhados em código
  (`src/sprites.js`), inclusive o ícone do app.
- Chefes e inimigos grandes em alta definição: o canvas tem o dobro de pixels
  por dentro e essas peças usam o dobro de detalhe, com sombra em 3 tons, brilho
  na borda e pontilhado (`src/pixel-hd.js`, `src/art-chefes.js`,
  `src/art-grandes.js`). O resto mantém o pixel de sempre.
- Variações geradas, não desenhadas à mão: tiros nas cores de cada faixa,
  paletas das voltas, contorno de elite e armadura quebrada dos chefes.
- Tiros inimigos são o que mais contrasta na tela (núcleo claro e contorno
  escuro); os seus tiros são mais discretos.
- Animações: chama do motor, inclinação da nave nas curvas, inimigos com 2
  quadros, cápsulas piscando, cristais girando, explosões com partículas.
- Sons sintetizados (Web Audio, sem arquivos) e música chiptune gerada em tempo
  real, com camadas que entram quando a ação esquenta. Som, música e vibração
  desligáveis.

## Arquitetura

JavaScript puro em módulos, canvas 2D e Web Audio. Sem framework. Simulação em
passo fixo (120 por segundo) e sorteios com semente: a mesma semente gera a
mesma partida, o que permite testar e balancear com bots sem navegador.

| Arquivo | Papel |
|---|---|
| `src/config.js` | Números do jogo: armas, inimigos, setores, economia. |
| `src/rng.js` | Sorteio com semente. |
| `src/power.js` | Faixas de cor, estrelas, dano e formas por nível. Testado. |
| `src/weapons.js` | Padrões de tiro, raio, foguetes e drones por nível, sem teto. Testado. |
| `src/drops.js`, `src/loot.js` | Chance, tipo e raridade das cápsulas (garantias, recuperação). Testado. |
| `src/director.js` | Ritmo das ondas, ciclo de tensão e ajuste de dificuldade. Testado. |
| `src/enemies.js`, `src/waves.js`, `src/bosses.js` | Inimigos, formações e chefes. |
| `src/game.js` | Estado da partida e atualização em passo fixo. Testado. |
| `src/progress.js`, `src/missions.js`, `src/stats.js` | Hangar, naves, patentes, missões e estatísticas. Testado. |
| `src/bot.js` | Piloto automático (tela inicial e simulação de balanceamento). |
| `src/sprites.js`, `src/pixel.js`, `src/pixel-hd.js`, `src/art-*.js`, `src/font.js` | Pixel art, editor de pixels, peças em alta definição e fonte do canvas. |
| `src/render.js` | Desenho, partículas e efeitos. |
| `src/audio.js`, `src/music.js` | Efeitos, música e vibração. |
| `src/ui.js`, `src/format.js`, `src/main.js` | Telas, entrada (toque, mouse, teclado) e laço de quadros. |
| `src/storage.js`, `src/analytics.js` | Progresso no aparelho e envio opcional de estatísticas. |

## Testes

- `node --test` (141 testes): armas e formas, raridade e garantias, Diretor,
  missões, hangar, estatísticas, chefes e partidas inteiras com semente.
- `npm run balance`: bots de três níveis de habilidade jogam em paralelo e o
  relatório confere os critérios de balanceamento; `-- longo` deixa o melhor
  piloto jogar até 60 minutos.
- `npm run smoke`: Playwright abre o build, joga, pega cápsulas (inclusive
  lendária), enfrenta chefe, perde, recomeça, compra no hangar, abre a Coleção e
  confere que não há erro no console, no computador e no celular, também com
  "reduzir movimento".
- `npm run perf`: pior caso num celular simulado com CPU 4× mais lenta.
- `npm run sprites`: folhas de prévia de todos os sprites, dos chefes (inteiro,
  quebrado e na volta 1) e das variações de volta e elite.

## Balanceamento (simulação)

`npm run balance` (30 partidas por linha, limite de 15 min) e `npm run balance --
longo` (20 partidas por linha, limite de 60 min, com outras sementes). Os bots
desviam com mais precisão que uma pessoa (veem todos os tiros próximos e não têm
o dedo na frente da tela), então servem para comparar versões e enxergar a curva,
não para prever o tempo exato de uma pessoa.

| Piloto | Limite | Duração (mediana) | Setor | Metralhadora | Mais derruba |
|---|---|---|---|---|---|
| Iniciante, sem melhorias | 15 min | 5 min | 4 | nível 13 | chefe (60%) |
| Médio, sem melhorias | 15 min | 13,4 min | 9 | nível 28 | tempo (40%) |
| Experiente, sem melhorias | 15 min | 14,2 min | 10 | nível 33 | tempo (47%) |
| Médio, com hangar | 15 min | 15 min (limite) | 11 | nível 58 | tempo (100%) |
| Experiente, sem melhorias | 60 min | 14,5 min | 10 (máx. 18) | nível 32 | chefe (45%) |
| Médio, com hangar | 60 min | 30 min | 20 (máx. 25) | nível 101 | Atirador (50%) |

"Com hangar" é casco, canhão, foguetes, escudo que volta, ímã e sorte, cerca de
3.300 cristais de melhorias.

O que isso mostra:

- O começo tem o dobro de inimigos por minuto da 1.0 (115 contra 54 no setor 1).
- Com as armas sem teto, a 1.0 deixava a nave forte demais para sempre (o
  melhor bot chegava ao setor 40 com a metralhadora no nível 209). Ajustes: dano
  de 2% por nível (as formas, os canos e as estrelas carregam o ganho de força),
  cápsulas 40% mais raras a cada setor (o chefe ainda solta 2), elites crescendo
  até 50% e chefes do fim da volta mais duros.
- Mesmo assim, com melhorias do hangar o dano crescia mais rápido que a vida dos
  inimigos: 85% das partidas do piloto médio chegavam a 60 minutos (setor 39,
  metralhadora no nível 199). Agora a vida dos inimigos comuns é multiplicada por
  1,85 a cada volta (os chefes mantêm o bônus de volta deles) e todas as partidas,
  com ou sem hangar, acabam antes do setor 30.
- Ao entrar na Raio a metralhadora nunca bate menos que na forma anterior (o
  feixe tem 2,4× de dano por tique), e os drones no nível 10 também não (o raio
  deles vai até o alto da tela). Com os drones acertando de novo, o piloto médio
  dura mais: 13,4 min, dentro da meta de 8 a 14.
- O tempo do iniciante varia com as sementes (de 2,7 a 5 min nas que testamos,
  igual antes destas mudanças): a maioria cai no primeiro chefe.

## Auditoria técnica

| Área | Resultado |
|---|---|
| Testes | 141 testes de regras e partidas simuladas; teste de ponta a ponta no navegador (computador, celular e "reduzir movimento") sem erro no console. |
| Desempenho | Pior caso com a tela cheia (Forja na fase 2, 220 tiros inimigos e 260 da nave, metralhadora 40, foguetes 20, drones 9, mais um lote de sete ondas que não morrem) a 60 quadros por segundo de média com CPU 4 vezes mais lenta em 5 de 6 medições (a outra, 57). Tiros simples saem em lote (um preenchimento por cor em vez de um desenho por tiro), os tiros inimigos são copiados já em 2×, a colisão olha só a coluna de cada tiro e, com mais de 300 tiros na tela, o rastro e as partículas diminuem e as nebulosas do fundo somem. Sprites do jogo prontos em menos de 200 ms (meta: 300; a arte em alta definição dos chefes é montada ao carregar e não entra nessa conta). Variações de volta, elite e armadura são geradas só quando aparecem. Jogo inteiro em um HTML de 191 KB. |
| Revisão de código | Versão 1.0: 10 problemas achados e corrigidos (ex.: modo offline podia guardar versão antiga, foguete perseguia inimigo fora da tela, botão pulava a proteção contra toque acidental, `versionCode` fixo travaria a Google Play). Versão 1.1: revisão do código novo inteiro achou 7 problemas importantes e 11 menores; os 7 e mais 2 menores que pesavam para quem joga foram corrigidos, cada um com um teste que falhava antes (ex.: voltar do Android na Coleção fechava o app, drones paravam de acertar no nível 10, meta de nível da metralhadora quase impossível, partidas sem fim com melhorias do hangar); os outros 9 menores ficaram anotados. |
| Fotossensibilidade | Clarão de tela inteira no máximo 3 vezes por segundo (contado no teste); "reduzir movimento" desliga clarões, tremores, rastros e câmera lenta. |
| Som | Medido no navegador: música e efeitos tocam; no pior caso (12 explosões, chefe e Pulso juntos) o pico fica em 0,6, sem distorção. |
| Acessibilidade | Botões de 44 px ou mais (conferido no teste da Coleção), foco visível no teclado, textos de leitor de tela no casco e nas missões, sem pisca-pisca rápido em áreas grandes, cápsulas com letra além da cor. |
| Legibilidade | Na fonte pixel o 5 parecia S e o 2 parecia Z: os números vêm de outra fonte (Jersey 10). No canvas, a fonte de 3×5 ganhou "·" e uma ★ de 5 pixels. |
| Saves antigos | Abrem sem perder nada (testado): cristais, melhorias e recordes ficam; os chefes que a pessoa já derrotou na 1.0 (deduzidos do melhor setor) aparecem na Coleção. |
| Privacidade | Nenhuma chamada de rede no build padrão; progresso e estatísticas só no aparelho. |
| Lojas | Ícone sem transparência para o iPhone, ícone adaptativo e abertura para o Android, só retrato, tela cheia, voltar do Android pausa o jogo, iPhone adia o gesto da borda de baixo. Páginas de privacidade e suporte com contato. Envio às lojas pelo GitHub, sem computador: chave de envio, AAB assinado (testado a cada push com chave descartável) e TestFlight. |
| Dependências | Nenhuma vulnerabilidade nas dependências do app. As ferramentas de linha de comando do Capacitor (só usadas no computador e no CI) têm alertas do `npm audit` sem correção disponível na versão 8; não entram no app. |

## Fora da v1

Ranking online, conquistas das lojas, anúncios, compras, modo para dois
jogadores, idioma inglês.
