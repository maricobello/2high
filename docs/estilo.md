# Guia de estilo

Referência visual e de texto das páginas deste projeto. Ao criar ou alterar uma
página, siga este guia e **mude uma coisa por vez**.

## Princípios

1. **Manter o que funciona.** Todo pedido de mudança diz o que muda; o resto fica igual.
2. **Uma seção por vez.** Nada de redesenhar a página inteira num passo só.
3. **Concreto, não adjetivo.** "Título menor", "menos texto", "tirar o brilho da borda", não "mais profissional".
4. **Publicar direto.** Depois das checagens (build, testes e prints no computador e no celular), a mudança vai direto para o ar. Link de prévia só se o dono pedir.

## Visual

### Cores

| Uso | Token | Valor |
|---|---|---|
| Fundo das seções escuras (topo, destaques) | `--ink` | `#04060c` |
| Fundo das seções claras | `--background` | `#f7f8fb` |
| Texto principal | `--foreground` | `#070b16` |
| Texto secundário | `--muted` | `#4a5367` |
| Botões e links | `--primary` | `#3d5afe` |
| Destaque (só sobre fundo escuro) | `--volt` | `#ffc83d` |
| Cards | `--card` | `#ffffff` |

- O amarelo é só para **uma** palavra ou frase de destaque por bloco e para os ícones de check.
- Verde, laranja e vermelho são só para sinais (oportunidade, análise, atenção).

### Tipografia

- Fonte única: **Geist Sans**. Títulos em negrito, letras bem juntas (`tracking` negativo).
- Título do topo: 33px no celular, 52px no tablet, 64px no computador.
- Títulos de seção: 32px no celular, 48px no computador.
- Texto de apoio: 16–18px, cor `--muted` (ou branco a 75–80% no fundo escuro).

### Topo (hero)

- Fundo `--ink` com brilho azul sutil (`.glow`) e textura de pontos com máscara radial.
- Esquerda: título + subtítulo curto + até 3 tópicos com check amarelo (tópicos só no computador).
- Direita (abaixo, no celular): **quiz** em card branco, cantos bem arredondados (28px), sombra profunda.
- Frase-chave do título em amarelo, com **sublinhado desenhado à mão** (SVG animado).
- Abaixo do topo: faixa de distribuidoras rolando sozinha (Marquee).

### Componentes

- **Card:** branco, borda fina `--border`, cantos 16–28px.
- **Botão principal:** azul `--primary`, texto branco, negrito.
- **Selos e rótulos pequenos:** caixa-alta com espaçamento largo, em azul, **com moderação**.
- **Seções:** alternam fundo escuro e claro; uma ideia por seção.
- **Números:** contam ao aparecer (NumberTicker).

### Animações

- Discretas e rápidas (0,2–0,7s). Nada que atrase a leitura.
- Título do topo: palavras surgindo uma a uma (CSS, não atrasa o carregamento).
- Blocos: aparecem com leve subida ao rolar a página.
- Sempre respeitar "reduzir movimento" do sistema.

## Texto (copy)

- **Título:** uma pergunta que leve o cliente a se avaliar, ou uma promessa clara com condição. Uma frase-chave destacada.
- **Subtítulo:** no máximo 2 linhas no computador e 3 no celular. Diz o que fazemos e o que a pessoa ganha.
- **Tom:** direto, seguro, sem gírias e sem exclamações. Frases curtas.
- **Nunca prometer resultado.** Usar "pode", "possível", "estimativa". Valores de exemplo sempre marcados como **fictícios**.
- **Base legal** citada de forma curta (ex.: "CDC, art. 42"), nunca como argumento de venda exagerado.

## Conversão

- A página abre com um **quiz de 5 perguntas** de um toque.
- O resultado personalizado aparece **antes** de pedir nome, e-mail e WhatsApp.
- Depois do contato, pedir a fatura, com a opção "enviar depois".
- No celular, o quiz aparece sem rolar (ou quase) e existe uma barra fixa de CTA.
- Consentimento de LGPD explícito e separado do opt-in de marketing.

## Modelo de pedido

```
Mantenha o estilo de docs/estilo.md.
Mude só: [a seção/elemento].
O que quero: [descrição concreta: tamanho, cor, texto, ordem].
Referência: [link ou print, e o que gosto nele].
Sucesso é: [ex.: o quiz aparece sem rolar no celular].
(Opcional) Me mostre 3 opções de texto antes de aplicar.
```
