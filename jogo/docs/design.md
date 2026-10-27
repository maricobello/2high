# PRUMO: design e auditoria das mecânicas

Jogo de um toque: um bloco desliza sobre a torre e você toca para soltá-lo. O que
sobra para fora é cortado e cai. A torre afina a cada erro e se recupera com acertos
perfeitos. "Prumo" é o fio de chumbo que o pedreiro usa para conferir se a parede
está reta; no jogo, uma linha fina marca o centro da torre.

## Objetivo

- Muito simples: blocos retangulares, fundo em degradê, poucos textos.
- Viciante "do jeito bom": a pessoa quer jogar mais uma porque sente que está
  melhorando, não por punição, energia ou anúncio.
- Uma base de código para site (PWA), iPhone e Android (via Capacitor).

## O loop

1. Bloco desliza de um lado para o outro acima da torre.
2. Toque: o bloco para. A parte que coincide com o bloco de baixo fica, o resto cai.
3. Errou tudo (nenhuma parte coincide): a partida acaba.
4. Partidas de 20 a 60 segundos. Reiniciar leva menos de 1 segundo.

## Auditoria: o que deixa o jogo viciante e como o PRUMO aplica

| Mecanismo | Por que prende | Como está no jogo |
|---|---|---|
| Loop curtíssimo | Custo de tentar de novo perto de zero. | Tela de derrota curta; um toque em qualquer lugar reinicia. |
| Quase-acerto | Errar por pouco é lido como "eu consigo". | A torre fina continua viva; a mensagem de derrota diz quanto faltou ("Faltaram 2 andares"). Recorte de menos de 20% mostra "Por pouco". |
| Recuperação | Esperança de salvar a partida mantém a atenção. | A partir do 3º acerto perfeito seguido, cada perfeito devolve largura ao bloco. |
| Combo sonoro | Uma melodia que sobe cria vontade de não quebrar a sequência. | Cada perfeito toca a próxima nota de uma escala pentatônica; errar volta ao início. |
| Maestria visível | Progresso pessoal é a motivação mais durável. | Estrelas por fase (1 por concluir, 2 e 3 por perfeitos) e linha de recorde no Infinito. |
| Meta à vista | Quanto mais perto da meta, mais esforço (goal gradient). | Linha tracejada "META" na altura da fase; contador "7/12". |
| Novidade em doses | Cada fase traz uma regra nova, o cérebro quer ver a próxima. | 8 fases: velocidade, ritmo variável, vento, velocidade aleatória, largura menor. |
| Recompensa final | Ver o que construiu fecha o ciclo com prazer. | Ao concluir, a câmera afasta e mostra a torre inteira; blocos acendem de baixo para cima; estrelas aparecem uma a uma com som. |
| Desbloqueio | Algo novo para conquistar. | Infinito libera após a fase 3. Cada fase libera a seguinte. |
| Juice | Resposta forte a cada toque dá prazer físico. | Som, vibração (onde houver), anel de luz no perfeito, pedaço cortado girando ao cair. |

### Limites éticos ("do jeito bom")

- Sem energia, vidas ou espera para jogar.
- Sem sequência diária que pune quem some por uns dias.
- Sem anúncios, compras ou caixas de recompensa na v1.
- Pausa automática ao sair do app; respeita "reduzir movimento" do sistema.
- Som pode ser desligado e a escolha fica salva.

## Fases

| # | Nome | Meta | Regra nova |
|---|---|---|---|
| 1 | Alicerce | 10 | Lento e constante. Primeira vitória quase garantida. |
| 2 | Térreo | 12 | Mais rápido. |
| 3 | Andaime | 14 | Ritmo variável: acelera no meio, freia nas pontas. |
| 4 | Vento | 14 | A torre balança. |
| 5 | Guindaste | 15 | Cada bloco vem numa velocidade diferente. |
| 6 | Mirante | 16 | Começa com blocos mais estreitos. |
| 7 | Arranha-céu | 18 | Ritmo variável, vento e velocidade aleatória. |
| 8 | Cobertura | 20 | Tudo junto, mais rápido e com margem menor. |
| ∞ | Infinito | — | Velocidade sobe a cada andar; as regras entram aos poucos. |

Estrelas: 1 por concluir; 2 com perfeitos em 35% dos andares; 3 com 65%.

## Arquitetura

JavaScript puro em módulos, canvas 2D e Web Audio (sons sintetizados, sem
arquivos). Sem framework. Um passo de build (esbuild) junta tudo num HTML único.

| Arquivo | Papel |
|---|---|
| `src/core.js` | Regras puras: corte do bloco, perfeito, movimento, estrelas, progresso. Testado. |
| `src/phases.js` | Dados das fases. Testado. |
| `src/game.js` | Estado da partida e atualização a cada quadro. |
| `src/render.js` | Desenho no canvas (blocos, câmera, efeitos). |
| `src/audio.js` | Sons sintetizados e vibração. |
| `src/storage.js` | Progresso salvo no aparelho (localStorage, tolerante a falha). |
| `src/main.js` | Telas (início, jogo, pausa, resultado) e entrada (toque, clique, espaço). |

Saídas do build: `dist/index.html` (arquivo único para site e app) e
`dist/artifact.html` (prévia jogável).

## Testes

- `node --test`: regras de corte, perfeito, recuperação, estrelas, progresso e
  consistência das fases.
- Verificação no navegador (Playwright): abre, joga, conclui fase, perde, sem erros
  no console, no computador e no celular.

## Fora da v1

Anúncios, ranking online, conquistas da loja, música de fundo, temas extras.
