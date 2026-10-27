# PRUMO

Jogo de empilhar de um toque. Um bloco desliza sobre a torre; toque para soltar.
O que sobra para fora é cortado. Acertos perfeitos seguidos devolvem largura e
tocam uma melodia que sobe. 8 fases com regras novas e um modo Infinito.

Design e auditoria das mecânicas: [docs/design.md](docs/design.md).

Projeto à parte do site: tem dependências, testes e build próprios.

## Rodar no computador

```bash
cd jogo
npm install
npm run dev          # http://localhost:5173 (código-fonte, sem build)
```

Controles: toque, clique, Espaço ou Enter para soltar. Esc pausa. M liga e desliga o som.

## Testes

```bash
npm test             # regras do jogo (node --test)
npm run build
npm run smoke        # joga sozinho no navegador, no computador e no celular; prints em tests/prints/
```

## Build

`npm run build` gera `dist/`:

| Arquivo | Uso |
|---|---|
| `dist/index.html` | o jogo inteiro num arquivo só (JS, CSS e fonte embutidos) |
| `dist/sw.js`, `manifest.webmanifest`, `icons/` | instalar como app e jogar sem internet |
| `dist/artifact.html` | prévia jogável publicada no claude.ai |

## Publicar

**Site:** https://prumo-jogo.vercel.app (projeto `prumo-jogo` na Vercel, diretório
`jogo`, build `npm run build`, saída `dist`). No celular, "Adicionar à tela de início"
instala como app (tela cheia e offline).

**Lojas:** siga [docs/publicar-nas-lojas.md](docs/publicar-nas-lojas.md). Os workflows
do GitHub fazem o trabalho pesado:

| Workflow | Quando roda | O que faz |
|---|---|---|
| Jogo PRUMO · APK Android | push em `jogo/` | testes, APK de teste (`prumo-apk`) e checagem do AAB assinado |
| Jogo PRUMO · iOS | push no projeto iOS | compila para iPhone num Mac, sem assinar |
| Jogo PRUMO · Lojas | à mão | chave do Android, AAB assinado para a Play, envio ao TestFlight |

**Com Android Studio ou Xcode instalados** (opcional): `npm run cap:android` ou
`npm run cap:ios` faz o build, sincroniza e abre o projeto nativo.

**Depois de mudar o jogo:**

- `npm run build && npx cap sync`
- Imagens das lojas: `npm run loja`
- Ícone: edite `icon.svg`, rode `npm run icons` e depois
  `npx capacitor-assets generate --android --ios`
- E-mail de contato das páginas de privacidade e suporte: `loja/config.json`

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | código do jogo (regras em `core.js`, fases em `phases.js`) |
| `tests/` | testes das regras e teste no navegador |
| `android/`, `ios/` | projetos nativos (Capacitor) |
| `assets/` | origem dos ícones e da abertura nativos |
| `loja/` | capturas, imagem de destaque, ícone e textos da ficha das lojas |
| `privacidade.html`, `suporte.html` | páginas exigidas pelas lojas |
| `fonts/` | Unbounded (SIL Open Font License) |
