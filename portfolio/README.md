# /m/ — portfólio de Matheus Andrioni Raioxobelli

Site estático (HTML, CSS e JS puros, sem build). Base visual e motor de animação:
[itachi](https://github.com/Meghamittal0920/itachi), por Meghamittal0920.

- `index.html` — conteúdo: título, projetos (posts do "thread"), sobre e contato.
- `style.css` — tema escuro + camada de imageboard.
- `main.js` — frames no scroll, olhos que seguem o cursor, Amaterasu, tempestade,
  ghost cursor e os recursos do board (catálogo, prévia de `>>links`, backlinks).
- `frames/` — frames em WebP (convertidos dos JPG originais).

Para adicionar um projeto, copie um `<article class="post card">` em `index.html`,
troque o número (`id="p…"` e `data-no`), o kanji, o texto e os links.

Rodar localmente: `npx serve portfolio` (ou qualquer servidor estático).
Deploy: projeto Vercel com *Root Directory* `portfolio` e *Framework* "Other".
