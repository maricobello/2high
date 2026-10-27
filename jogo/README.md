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

## Publicar no site

Qualquer hospedagem de arquivos estáticos serve. Suba o conteúdo de `dist/`.

- **Vercel:** novo projeto apontando para este repositório, com *Root Directory*
  `jogo`, *Build Command* `npm run build` e *Output Directory* `dist`.
- **Dentro do site atual:** copiar `dist/` para `public/jogo/` deixa o jogo em
  `/jogo/index.html`.

No celular, "Adicionar à tela de início" instala como app (abre em tela cheia e funciona offline).

## Android (APK e Google Play)

**APK de teste, sem instalar nada:** cada push que mexe em `jogo/` roda o
workflow `Jogo PRUMO · APK Android` no GitHub. Em *Actions*, abra a última
execução e baixe `prumo-apk`. Copie o `app-debug.apk` para o celular e instale
(o Android pede para permitir apps de fontes desconhecidas).

**Google Play:** precisa de conta de desenvolvedor (taxa única de US$ 25) e de um
pacote assinado:

```bash
npm run cap:android  # build + sincroniza + abre no Android Studio
```

No Android Studio: *Build > Generate Signed App Bundle*, crie a chave (guarde-a:
sem ela não dá para atualizar o app) e envie o `.aab` no Play Console.

## iPhone (App Store)

Precisa de um Mac com Xcode e de conta Apple Developer (US$ 99 por ano).

```bash
npm run cap:ios      # build + sincroniza + abre no Xcode
```

No Xcode: escolha seu *Team* em *Signing & Capabilities*, depois
*Product > Archive* e *Distribute App* para enviar ao App Store Connect.

## Antes de lançar nas lojas

- Troque `appId` em `capacitor.config.json` (hoje `com.maricobello.prumo`) por um
  domínio seu ao contrário, antes do primeiro envio: depois não muda mais.
- Política de privacidade: o jogo não coleta dados nem usa internet; o progresso
  fica só no aparelho. As lojas pedem um link com esse texto.
- Ícone e abertura: edite `icon.svg` e rode `npm run icons` e
  `npx capacitor-assets generate --android --ios`.
- Depois de qualquer mudança no jogo: `npm run build && npx cap sync`.

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/` | código do jogo (regras em `core.js`, fases em `phases.js`) |
| `tests/` | testes das regras e teste no navegador |
| `android/`, `ios/` | projetos nativos (Capacitor) |
| `assets/` | origem dos ícones e da abertura nativos |
| `fonts/` | Unbounded (SIL Open Font License) |
