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

Tema escuro em todo o site, paleta "confiança": azul-marinho + azul + destaque amarelo.

| Uso | Token | Valor |
|---|---|---|
| Fundo do topo e destaques | `--ink` | `#04060c` |
| Fundo das seções | `--background` | `#060913` |
| Cards | `--card` | `#0d1424` |
| Texto principal | `--foreground` | `#f2f4f8` |
| Texto secundário | `--muted` | `#a3adc2` |
| Botões, bordas e barras | `--primary` | `#3d5afe` |
| Texto sobre o azul | `--primary-foreground` | `#ffffff` |
| Links e rótulos (texto azul) | `--primary-text` | `#8da0ff` |
| Frase de destaque | `--volt` | `#ffc83d` |

- Botão principal: pílula azul, texto branco, caixa-alta com espaçamento.
- O amarelo destaca **uma** frase por bloco (ex.: "Alguém confere?").
- Verde só para sinais positivos (oportunidade) e para o raio da logo; laranja e vermelho só para sinais (análise, atenção).
- Nunca usar cor fixa no código: tudo sai dos tokens em `src/app/globals.css`.

**Estilo guardado "verde energia":** preto esverdeado + verde `#3ee066`, pronto em `globals.css` (`:root[data-theme="verde"]`). Para voltar a ele, basta `data-theme="verde"` na tag `<html>` em `src/app/layout.tsx`.

### Marca

- Logo: "A" em chevron com raio verde + "ΛFERI" + "Gestão inteligente de energia" (`src/components/site/logo.tsx`; favicon em `src/app/icon.svg`).
- Rótulos (eyebrows): fonte mono, caixa-alta, espaçamento largo, em azul claro (`--primary-text`), com traço à esquerda.

### Tipografia

- Fonte única: **Geist Sans**. Títulos em negrito, letras bem juntas (`tracking` negativo).
- Título do topo: 33px no celular, 52px no tablet, 64px no computador.
- Títulos de seção: 32px no celular, 48px no computador.
- Texto de apoio: 16–18px, cor `--muted` (ou branco a 75–80% no fundo escuro).

### Topo (hero)

- Fundo: foto de usina solar e linha de transmissão ao pôr do sol (escurecida à esquerda), com cenário em SVG por baixo como reserva e uma linha animada na cor de destaque.
- Esquerda: rótulo "Auditoria e gestão de energia", título (com sublinhado desenhado à mão em "Alguém confere?"), subtítulo, balão "Escute nosso especialista" (áudio de ~2 min, carrega só no play), 3 serviços com ícones azuis e 2 botões (só no computador).
- Direita (abaixo, no celular): **quiz** em card escuro translúcido (a foto aparece por trás), borda azul com feixe de luz girando (BorderBeam), cantos 28px.
- Frase-chave do título em amarelo (`--volt`), com sublinhado desenhado à mão.
- Abaixo do topo: faixa de distribuidoras rolando devagar (Marquee).

### Componentes

- **Card:** `--card`, borda fina `--border` (ou azul a 25–40% nos destaques), cantos 16–28px.
- **Botão principal:** pílula azul `--primary`, texto `--primary-foreground`, caixa-alta.
- **Selos e rótulos pequenos:** mono, caixa-alta, espaçamento largo, em azul claro, **com moderação**.
- **Seções:** fundos escuros alternando `--ink` e `--background`; uma ideia por seção.
- **Números:** contam ao aparecer (NumberTicker).

### Animações

- Discretas e rápidas (0,2–0,7s). Nada que atrase a leitura.
- Título do topo: palavras surgindo uma a uma (CSS, não atrasa o carregamento).
- Blocos: aparecem com leve subida ao rolar a página.
- Sempre respeitar "reduzir movimento" do sistema.

### Relatório (pós-análise da fatura)

- Página `/diagnostico/[token]` (`src/components/diagnostic/report.tsx`), largura máxima de 1600px, centralizada no ultrawide.
- Ordem: cabeçalho (título, selo "Preliminar", protocolo, data, "Exportar PDF" e "Compartilhar") → faixa de dados (cliente, perfil, distribuidora, unidade mascarada, período, documento) → resumo com o maior potencial estimado → indicadores e próximos passos → principais achados → histórico de consumo e metodologia → rodapé.
- No computador (≥1280px) indicadores e próximos passos ficam numa coluna fixa à direita; no celular e tablet vêm logo depois do resumo.
- Cada achado: número, título, tipo (cor do sinal), dados utilizados, confiança (Alta/Média/Baixa, sem porcentagem inventada) e impacto estimado ("até R$ X" quando a faixa começa em zero).
- Alternativas (GD, Mercado Livre) não se somam: o destaque mostra a **maior** faixa.
- **Sem citar IA** em nenhuma página do cliente. O uso da IA fica só no admin (`/admin/ia`).
- "Exportar PDF" usa a impressão do navegador: papel branco, sem menu, botões ou chamadas.

### Vídeos e imagens de divulgação

- Feitos no estúdio `studio/` (Remotion), com as mesmas cores, fonte e logo do site. Como usar: `docs/estudio.md`.

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
