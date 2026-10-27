# RAJADA

Nave retrô de rolagem vertical, jogada com um dedo. A nave atira sozinha; você
arrasta para desviar e mirar. Cápsulas dão upgrades na hora (mais metralhadoras,
foguetes teleguiados, drones, escudo), cada setor termina com um chefe e os
cristais coletados compram melhorias permanentes no hangar. Só mais uma rajada.

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
npm run balance      # bots jogam dezenas de partidas: duração, setor, cristais
npm run build
npm run smoke        # joga no navegador, no computador e no celular; prints em tests/prints/
```

## Build

`npm run build` gera `dist/`:

| Arquivo | Uso |
|---|---|
| `dist/index.html` | o jogo inteiro num arquivo só (JS, CSS e fontes embutidos) |
| `dist/sw.js`, `manifest.webmanifest`, `icons/` | instalar como app e jogar sem internet |
| `dist/privacidade.html` | política de privacidade (as lojas pedem o link) |
| `dist/og.png` | imagem de compartilhamento |
| `dist/artifact.html` | prévia jogável publicada no claude.ai |

## Site

Qualquer hospedagem de arquivos estáticos serve: suba o conteúdo de `dist/`.
Na Vercel: projeto novo com *Root Directory* `rajada`, *Build Command*
`npm run build` e *Output Directory* `dist`.

## Android

- **APK de teste:** o workflow `Jogo RAJADA` (GitHub Actions) gera o APK a cada
  push que mexe em `rajada/`. Em *Actions*, abra a execução e baixe
  `rajada-android`. A main (ou *Run workflow*) também publica o APK com link
  direto na página de versões, tag `rajada-apk`.
- **Google Play:** o mesmo workflow gera o `rajada-loja.aab` assinado quando os
  secrets de assinatura existem. Passo a passo em [docs/lancamento.md](docs/lancamento.md).
- **No Android Studio:** `npm run cap:android`.

## iPhone

O workflow confere que o app compila num Mac do GitHub (Xcode 26). Para
publicar, é preciso um Mac com Xcode e conta Apple Developer:

```bash
npm run cap:ios      # build + sincroniza + abre no Xcode
```

No Xcode: *Signing & Capabilities* > *Team*, depois *Product > Archive* e
*Distribute App*. Detalhes em [docs/lancamento.md](docs/lancamento.md).

## Arte e imagens

Toda a pixel art está em `src/sprites.js` (texto, um caractere por pixel).

```bash
npm run sprites      # folha com todos os sprites ampliados (tests/prints/sprites.png)
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
| `store/` | capturas e imagem de destaque para as lojas |
| `fonts/` | Pixelify Sans e dígitos da Jersey 10 (SIL Open Font License) |
