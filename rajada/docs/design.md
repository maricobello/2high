# RAJADA: design e auditoria das mecânicas

Nave retrô de rolagem vertical, jogada com um dedo. A nave atira sozinha; você
arrasta para desviar e mirar. Inimigos descem a tela sem parar, cápsulas dão
upgrades na hora (mais metralhadoras, foguetes teleguiados, drones, escudo) e
cada setor termina com um chefe. Entre as partidas, os cristais coletados
compram melhorias permanentes no hangar.

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

Partidas de 1 a 4 minutos. Primeira partida desenhada para chegar ao primeiro
chefe com armas fortes (o momento "uau" no primeiro minuto).

## Armas (durante a partida)

| Cápsula | Letra e cor | Efeito | Máximo |
|---|---|---|---|
| Metralhadora | M, amarela | +1 fileira de tiros e cadência maior | nível 6 (5 fileiras) |
| Foguetes | F, laranja | foguetes teleguiados com explosão em área | nível 4 (4 por salva) |
| Drone | D, verde | uma nave de apoio ao lado, que atira junto | 2 drones |
| Escudo | E, azul | absorve um tiro | 1 |
| Reparo | coração, rosa | +1 de casco | casco máximo |
| Pulso | estrela, violeta | limpa os tiros da tela e fere todos os inimigos | uso imediato |

Cápsula de arma já no máximo vira bônus de pontos e cristais ("MAX").

**TURBO:** destruir inimigos e raspar nos tiros inimigos enche a barra do
TURBO. Cheia, ela dispara sozinha: 6 segundos de tiro dobrado, pontos em dobro
e música acelerada. Sem botão extra.

**Raspão:** tiro inimigo que passa muito perto da nave sem acertar vale pontos
e enche o TURBO. A área que machuca é só o centro da nave (3 px): passar raspando
é possível e dá a sensação de "por um triz".

## Inimigos e chefes

| Inimigo | Papel |
|---|---|
| Zangão | bucha de canhão, em fila, V ou serpente |
| Dardo | para, pisca e mergulha na sua direção |
| Atirador | para no alto e atira mirando em você |
| Couraçado | grande e lento, leque de tiros; sempre solta cápsula |
| Pedra | asteroide que se parte em pedaços menores |
| Mina | explode em anel de tiros quando destruída de perto |
| Portador | brilha e cruza a tela; destruído, solta cápsula |

Chefes, em rodízio, mais fortes a cada volta: **Colosso** (leques e espirais),
**Aranha** (espirais giratórias e rajadas) e **Olho** (laser com aviso e orbes
teleguiados). Cada chefe tem duas fases: abaixo de 50% de vida, o padrão muda.

Setores: Órbita Baixa, Cinturão, Nebulosa, Fronteira, Abismo; depois o ciclo
recomeça com cores novas e mais velocidade.

## O Diretor: dados da partida a serviço do fluxo

Um "Diretor" (como o de Left 4 Dead) decide o ritmo das ondas em tempo real.

| Dado medido | O que o Diretor faz |
|---|---|
| Ciclo de tensão do setor | sobe a pressão por ~15 s, pico de ~6 s, alívio de ~4 s, repete |
| Dano recente | segura ondas novas por 1,5 s (misericórdia) |
| Casco em 1 | reduz a pressão e aumenta a chance de Reparo |
| Muito tempo sem dano, armas fortes | aumenta a pressão (desafio) |
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

Cada 3 missões sobem a patente (Cadete, Aspirante, Piloto, Tenente, Capitão...).
Cada patente dá +5% de cristais (até +50%).

## Hangar (entre partidas)

| Melhoria | Efeito |
|---|---|
| Casco | +1 de casco máximo (2 níveis) |
| Canhão | começa com a metralhadora 1 nível acima (3 níveis) |
| Ímã | puxa cristais de mais longe (4 níveis) |
| Escudo | começa com escudo; nos níveis 2 e 3 ele volta sozinho |
| Sorte | mais cápsulas (3 níveis) |
| Foguetes | começa com foguetes (2 níveis) |

Naves liberadas por marcos, não por compra: **Faísca** (equilibrada),
**Vespa** (rápida, centro menor, menos casco; setor 3), **Bigorna** (mais
casco, começa com drone; 5 chefes) e **Cometa** (começa com foguetes;
12 missões).

## Auditoria: o que deixa o jogo viciante e como o RAJADA aplica

| Mecanismo | Por que prende | Como está no jogo |
|---|---|---|
| Loop curtíssimo | Custo de tentar de novo perto de zero. | Um toque recomeça; nada de carregamento. |
| Poder crescente | Fantasia de poder: ver a nave ficar forte. | Cápsulas mudam a arma na hora, com som e texto. |
| Recompensa variável | Cápsulas e cristais imprevisíveis atraem atenção. | Sorteio com garantia contra azar: nunca fica muito tempo sem nada. |
| Quase-acerto | Errar por pouco é lido como "eu consigo". | Raspão premiado; tela final mostra quanto faltou para o recorde e para cada missão. |
| Recuperação | Esperança de virar o jogo. | Arma perdida tende a voltar; misericórdia do Diretor; TURBO. |
| Combo sonoro | Melodia que sobe cria vontade de não quebrar a sequência. | Cristais seguidos tocam notas de uma escala pentatônica que sobe. |
| Metas à vista | Quanto mais perto da meta, mais esforço (goal gradient). | Barra do setor até o chefe; "faltam 23 cristais para o Ímã 2". |
| Novidade em doses | O cérebro quer ver o que vem depois. | Setores com nome e cor, chefes em rodízio, naves por marcos. |
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
| `src/weapons.js` | Padrões de tiro por nível. Testado. |
| `src/drops.js` | Chance e tipo de cápsula (garantia, misericórdia, recuperação). Testado. |
| `src/director.js` | Ritmo das ondas, ciclo de tensão e ajuste de dificuldade. Testado. |
| `src/enemies.js`, `src/waves.js`, `src/bosses.js` | Inimigos, formações e chefes. |
| `src/game.js` | Estado da partida e atualização em passo fixo. Testado. |
| `src/progress.js`, `src/missions.js`, `src/stats.js` | Hangar, naves, patentes, missões e estatísticas. Testado. |
| `src/bot.js` | Piloto automático (tela inicial e simulação de balanceamento). |
| `src/sprites.js`, `src/font.js` | Pixel art e fonte de pixels do canvas. |
| `src/render.js` | Desenho, partículas e efeitos. |
| `src/audio.js`, `src/music.js` | Efeitos, música e vibração. |
| `src/ui.js`, `src/format.js`, `src/main.js` | Telas, entrada (toque, mouse, teclado) e laço de quadros. |
| `src/storage.js`, `src/analytics.js` | Progresso no aparelho e envio opcional de estatísticas. |

## Testes

- `node --test`: armas, cápsulas, Diretor, missões, hangar, estatísticas e
  partidas inteiras com semente.
- `npm run balance`: bots de três níveis de habilidade jogam 120 partidas; o
  relatório mostra duração, setor alcançado, cápsulas e cristais por minuto e o
  que mais derruba.
- `npm run smoke`: Playwright abre o build, joga, pega cápsula, enfrenta chefe,
  perde, recomeça, compra no hangar e confere que não há erro no console, no
  computador e no celular.

## Balanceamento (simulação)

`npm run balance`, 30 partidas por linha. Os bots desviam com mais precisão que
uma pessoa (veem todos os tiros próximos e não têm o dedo na frente da tela),
então servem para comparar versões e enxergar a curva, não para prever o tempo
exato de uma pessoa.

| Piloto | Duração (mediana) | Setor | Cristais por partida | Mais derruba |
|---|---|---|---|---|
| Iniciante, sem melhorias | 2 min 55 s | 2 | 60 | chefe (90%) |
| Médio, sem melhorias | 8 min 46 s | 6 | 331 | laser e chefe |
| Experiente, sem melhorias | 8 min 9 s | 5 | 310 | chefe (67%) |
| Médio, com hangar | 10 min | 6 | 517 | chefe (63%) |

O que isso mostra:

- O primeiro chefe chega em pouco mais de 1 minuto e é o principal "portão" de
  quem está começando: a derrota vem num momento épico, com vontade de revanche.
- Cápsulas: cerca de 3 por minuto. A garantia contra azar evita secas longas e
  o Reparo não vem duas vezes em 45 s.
- Economia: a primeira melhoria (60 a 150 cristais) cabe em 1 ou 2 partidas,
  ainda mais com o bônus do dia. Tudo no máximo custa 7.660 cristais: semanas de
  meta para quem joga todo dia.
- Ajustes feitos com a simulação: vida dos chefes reduzida (lutas de 2 minutos
  com arma fraca), Dardo mais lento, laser do Olho trocado por feixes com aviso
  que dão para desviar (a varredura antiga cobria a tela inteira), Portador da
  primeira partida mais lento e frágil (o primeiro upgrade precisa sair).

## Auditoria técnica

| Área | Resultado |
|---|---|
| Testes | 43 testes de regras e partidas simuladas; teste de ponta a ponta no navegador (computador e celular) sem erro no console. |
| Revisão de código | 10 problemas achados e corrigidos (ex.: modo offline podia guardar versão antiga, foguete perseguia inimigo fora da tela, botão pulava a proteção contra toque acidental, `versionCode` fixo travaria a Google Play). |
| Desempenho | 60 quadros por segundo com até 320 objetos na tela e CPU 4 vezes mais lenta (simulando celular modesto). Jogo inteiro em um HTML de 155 KB. |
| Som | Medido no navegador: música e efeitos tocam; no pior caso (12 explosões, chefe e Pulso juntos) o pico fica em 0,6, sem distorção. |
| Acessibilidade | Botões de 44 px ou mais, foco visível no teclado, textos de leitor de tela no casco e nas missões, "reduzir movimento" desliga tremores e clarões, sem pisca-pisca rápido em áreas grandes, cápsulas com letra além da cor. |
| Legibilidade | Na fonte pixel o 5 parecia S e o 2 parecia Z: os números vêm de outra fonte (Jersey 10). |
| Privacidade | Nenhuma chamada de rede no build padrão; progresso e estatísticas só no aparelho. |
| Lojas | Ícone sem transparência para o iPhone, ícone adaptativo e abertura para o Android, só retrato, tela cheia, voltar do Android pausa o jogo, iPhone adia o gesto da borda de baixo. |
| Dependências | Nenhuma vulnerabilidade nas dependências do app. As ferramentas de linha de comando do Capacitor (só usadas no computador e no CI) têm alertas do `npm audit` sem correção disponível na versão 8; não entram no app. |

## Fora da v1

Ranking online, conquistas das lojas, anúncios, compras, modo para dois
jogadores, idioma inglês.
