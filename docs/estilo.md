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

Tema escuro em todo o site (identidade Aferi: preto esverdeado + verde energia).

| Uso | Token | Valor |
|---|---|---|
| Fundo do topo e destaques | `--ink` | `#030605` |
| Fundo das seções | `--background` | `#060a08` |
| Cards | `--card` | `#0c1310` |
| Texto principal | `--foreground` | `#eef3f0` |
| Texto secundário | `--muted` | `#9ba7a0` |
| Botões, links e destaque | `--primary` | `#3ee066` |
| Texto sobre o verde | `--primary-foreground` | `#03140a` |

- Botão principal: pílula verde, texto escuro, caixa-alta com espaçamento.
- O verde destaca **uma** frase por bloco (ex.: "Alguém confere?").
- Laranja e vermelho só para sinais (análise, atenção).

### Marca

- Logo: "A" em chevron com raio verde + "ΛFERI" + "Gestão inteligente de energia" (`src/components/site/logo.tsx`; favicon em `src/app/icon.svg`).
- Rótulos (eyebrows): fonte mono, caixa-alta, espaçamento largo, em verde, com traço à esquerda.

### Tipografia

- Fonte única: **Geist Sans**. Títulos em negrito, letras bem juntas (`tracking` negativo).
- Título do topo: 33px no celular, 52px no tablet, 64px no computador.
- Títulos de seção: 32px no celular, 48px no computador.
- Texto de apoio: 16–18px, cor `--muted` (ou branco a 75–80% no fundo escuro).

### Topo (hero)

- Fundo `--ink` com cenário em SVG (pôr do sol, torres, placas solares) e traços verdes.
- Esquerda: rótulo "Auditoria e gestão de energia", título, subtítulo, 3 serviços com ícones verdes e 2 botões (só no computador).
- Direita (abaixo, no celular): **quiz** em card escuro translúcido, borda verde, cantos 28px.
- Frase-chave do título em verde.
- Abaixo do topo: faixa de distribuidoras rolando devagar (Marquee).

### Componentes

- **Card:** `--card`, borda fina `--border` (ou verde a 25–40% nos destaques), cantos 16–28px.
- **Botão principal:** pílula verde `--primary`, texto `--primary-foreground`, caixa-alta.
- **Selos e rótulos pequenos:** mono, caixa-alta, espaçamento largo, em verde, **com moderação**.
- **Seções:** fundos escuros alternando `--ink` e `--background`; uma ideia por seção.
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
