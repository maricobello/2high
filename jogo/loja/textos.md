# Ficha das lojas: textos para copiar e colar

Cada campo traz o limite da loja entre parênteses. Os links usam o site do jogo
(veja `docs/publicar-nas-lojas.md`).

## Comum às duas lojas

**Nome do app** (30)

PRUMO: Torre de Blocos

**Categoria:** Jogos › Casual (secundária na Apple: Quebra-cabeça)

**Preço:** gratuito, sem compras no app e sem anúncios

**Classificação etária:** Livre / 4+ (sem violência, linguagem, sustos, apostas, compras ou conversa entre usuários)

**Política de privacidade:** `https://SEU-SITE/privacidade.html`

**Suporte:** `https://SEU-SITE/suporte.html`

## App Store (Apple)

**Subtítulo** (30)

Empilhe no tempo certo

**Texto promocional** (170)

Um toque, uma torre, só mais uma partida. 8 fases com regras novas e um modo Infinito para bater o seu recorde.

**Palavras-chave** (100, separadas por vírgula, sem espaço)

empilhar,toque,reflexo,casual,stack,tempo,precisão,arcade,offline,construir,prédio,equilíbrio

**Descrição** (4000)

PRUMO é um jogo de um toque: um bloco desliza sobre a torre e você toca para soltá-lo. O que fica para fora é cortado. Acerte em cheio e o bloco não perde nada.

COMO FUNCIONA
• Toque para soltar o bloco no prumo da torre.
• Acertos perfeitos seguidos tocam uma melodia que sobe.
• A partir do terceiro perfeito, o bloco volta a crescer.
• Errou por pouco? Recomeçar leva menos de um segundo.

8 FASES
Cada fase traz uma regra nova: ritmo que acelera e freia, vento que balança a torre, blocos que chegam em velocidades diferentes. Ganhe até 3 estrelas por fase.

MODO INFINITO
Fica mais rápido a cada andar. A linha do recorde mostra quanto falta.

SEM COMPLICAÇÃO
• Sem anúncios e sem compras.
• Sem cadastro e sem coleta de dados.
• Funciona sem internet.
• Partidas de menos de um minuto.

**Novidades desta versão** (4000)

Primeira versão.

**Notas para a revisão da Apple**

Jogo offline, sem login e sem compras. Toque em qualquer lugar da tela para soltar o bloco. A política de privacidade fica no rodapé da tela inicial.

**Privacidade do app (App Privacy):** "Dados não coletados" (Data Not Collected)

**Copyright:** 2026 SEU NOME

## Google Play

**Descrição curta** (80)

Solte o bloco no tempo certo e construa a torre mais alta com um toque só.

**Descrição completa** (4000): a mesma da App Store.

**Segurança dos dados (Data safety):** o app não coleta nem compartilha dados do usuário.

**Anúncios:** não contém anúncios.

**Público-alvo:** 13 anos ou mais (13 a 15, 16 a 17, 18+).

**Questionário de classificação (IARC):** categoria "Jogo"; responda "Não" para violência, sexo, linguagem, drogas, apostas, interação entre usuários, compartilhamento de localização e compras digitais.

## Imagens (pasta `loja/`)

| Loja | Arquivo | Tamanho |
|---|---|---|
| App Store | `capturas/iphone/1..5.png` | 1290 x 2796 (tela de 6,9") |
| Google Play | `capturas/android/1..5.png` | 1080 x 2160 (celular) |
| Google Play | `destaque-play.png` | 1024 x 500 (imagem de destaque) |
| Google Play | `icone-512.png` | 512 x 512 (ícone) |

O ícone da App Store vai dentro do app; não precisa enviar à parte.

Para refazer as imagens depois de mudar o jogo: `npm run build && npm run loja`.
