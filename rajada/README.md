# RAJADA

Nave retrô de rolagem vertical, jogada com um dedo. A nave atira sozinha; você
arrasta para desviar e mirar. Cápsulas dão upgrades na hora (mais metralhadoras,
foguetes teleguiados, drones, escudo), cada setor termina com um chefe e os
cristais coletados compram melhorias permanentes no hangar. Só mais uma rajada.

Versão 1.1: armas sem nível máximo (forma nova e cor de tiro nova a cada 5
níveis), cápsulas com raridade, inimigos mais resistentes a cada setor e 6
chefes em alta definição que voltam com paleta nova a cada volta.

- Design, mecânicas de retenção e auditoria: [docs/design.md](docs/design.md)
- Site, Google Play e App Store, passo a passo: [docs/lancamento.md](docs/lancamento.md)

Projeto à parte do site da Aferi: tem dependências, testes e build próprios.

## Rodar no computador

```bash
cd rajada
npm install
npm run dev          # gera dist/ e abre em http://localhost:5174
```

Controles: arrastar (toque), mouse ou setas/WASD para mover; a nave atira
sozinha. Esc ou P pausa, M liga e desliga a música.

## Testes

```bash
npm test             # regras do jogo e partidas simuladas (node --test)
npm run balance      # bots jogam 30 partidas por nível e conferem os critérios
npm run balance -- longo   # até 60 min, o melhor bot e o médio com hangar: as partidas acabam
npm run build
npm run smoke        # joga no navegador, no computador e no celular; prints em tests/prints/
npm run perf         # pior caso num celular simulado (CPU 4× mais lenta): meta 58 qps
```

## Build

`npm run build` gera `dist/`:

| Arquivo | Uso |
|---|---|
| `dist/index.html` | o jogo inteiro num arquivo só (JS, CSS e fontes embutidos) |
| `dist/sw.js`, `manifest.webmanifest`, `icons/` | instalar como app e jogar sem internet |
| `dist/privacidade.html`, `suporte.html` | páginas que as lojas pedem (contato em `store/config.json`) |
| `dist/og.png` | imagem de compartilhamento |
| `dist/artifact.html` | prévia jogável publicada no claude.ai |

A versão do jogo fica só em `package.json` e vale para o site, o Android e o iPhone.

## Site

https://rajada-jogo.vercel.app (projeto `rajada-jogo` na Vercel, configurado em
`vercel.json`). Atualiza sozinho a cada mudança no `main`. Qualquer hospedagem
de arquivos estáticos também serve: suba o conteúdo de `dist/`.

## Android

- **APK de teste:** o workflow `Jogo RAJADA` (GitHub Actions) gera o APK a cada
  push que mexe em `rajada/`. Em *Actions*, abra a execução e baixe
  `rajada-android`. A main (ou *Run workflow*) também publica o APK com link
  direto na página de versões, tag `rajada-apk`.
- **Google Play:** o workflow manual `Jogo RAJADA · Lojas` cria a chave de envio
  e gera o AAB assinado. Passo a passo em [docs/lancamento.md](docs/lancamento.md).
- **No Android Studio:** `npm run cap:android`.

## iPhone

O workflow `Jogo RAJADA` confere que o app compila num Mac do GitHub (Xcode 26).
O `Jogo RAJADA · Lojas` compila e envia ao TestFlight, também num Mac do GitHub:
basta a conta Apple Developer e os segredos descritos em
[docs/lancamento.md](docs/lancamento.md). Com um Mac, `npm run cap:ios` abre o
projeto no Xcode.

## Arte e imagens

A pixel art está em `src/sprites.js` (texto, um caractere por pixel); chefes e
inimigos grandes, em alta definição, em `src/art-chefes.js` e `src/art-grandes.js`.

```bash
npm run sprites      # folhas ampliadas: sprites.png, chefes.png e voltas.png em tests/prints/
npm run icons        # ícone, abertura e og.png a partir da nave
npx capacitor-assets generate --android --ios   # leva ícone e abertura para os apps
npm run store        # capturas das lojas e imagem de destaque em store/
```

Depois de mudar o jogo: `npm run build && npx cap sync`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | código do jogo (regras em `config.js`, partida em `game.js`) |
| `tests/` | testes das regras, simulador de balanceamento e teste no navegador |
| `android/`, `ios/` | projetos nativos (Capacitor) |
| `assets/` | origem dos ícones e da abertura nativos |
| `store/` | capturas, imagem de destaque e contato das páginas (`config.json`) |
| `fonts/` | Pixelify Sans e dígitos da Jersey 10 (SIL Open Font License) |
