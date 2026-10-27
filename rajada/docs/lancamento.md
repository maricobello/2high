# RAJADA: lançamento (site, Google Play e App Store)

O jogo está pronto para os três lugares. O que falta depende de contas e chaves
que só o dono pode criar. Este guia lista cada passo, na ordem.

## 0. Antes do primeiro envio

- **Identificador do app:** `com.maricobello.rajada` (em `capacitor.config.json`,
  no Android em `android/app/build.gradle` e no iPhone em
  `ios/App/App.xcodeproj`). Para trocar, troque nos três antes do primeiro envio:
  depois de publicado ele não muda mais.
- **Versão:** `1.0.0`. No Android o `versionCode` sobe sozinho no CI (número da
  execução). No iPhone, suba o *Build* no Xcode a cada envio.
- **Política de privacidade:** já está no site, em `/privacidade.html`. As duas
  lojas pedem esse link.

## 1. Site

Qualquer hospedagem de arquivos estáticos serve (o build é `dist/`).

Vercel (recomendado, é onde os outros sites já estão):

1. *Add New > Project*, escolha este repositório.
2. *Root Directory*: `rajada`. *Build Command*: `npm run build`. *Output Directory*: `dist`.
3. Domínio próprio é opcional (ex.: `rajada.seudominio.com.br`).

No celular, "Adicionar à Tela de Início" instala como app, com tela cheia e
modo offline.

## 2. Google Play (Android)

1. **Conta de desenvolvedor:** taxa única de US$ 25 no Play Console. Contas
   pessoais criadas depois de novembro de 2023 precisam rodar um **teste fechado
   com pelo menos 12 testadores por 14 dias seguidos** antes de liberar a
   produção. Comece por aqui, porque é o passo mais demorado.
2. **Chave de upload** (uma vez; guarde a chave e as senhas, sem elas não dá para
   atualizar o app):

   ```bash
   keytool -genkeypair -v -keystore rajada-upload.jks -alias rajada \
     -keyalg RSA -keysize 2048 -validity 10000
   base64 -w0 rajada-upload.jks > rajada-upload.txt   # no Mac: base64 -i rajada-upload.jks
   ```

3. **Secrets no GitHub** (*Settings > Secrets and variables > Actions*):

   | Secret | Valor |
   |---|---|
   | `RAJADA_KEYSTORE_BASE64` | conteúdo de `rajada-upload.txt` |
   | `RAJADA_KEYSTORE_PASSWORD` | senha da keystore |
   | `RAJADA_KEY_ALIAS` | `rajada` |
   | `RAJADA_KEY_PASSWORD` | senha da chave |

   A partir daí, cada execução do workflow `Jogo RAJADA` gera `rajada-loja.aab`
   (para a loja) e `rajada-assinado.apk` em *Artifacts > rajada-android*.
4. **Criar o app** no Play Console, ativar a *Assinatura de apps do Google Play*
   e enviar o `rajada-loja.aab` no teste fechado.
5. **Ficha da loja** (textos prontos no fim deste guia):
   - Ícone 512x512: `icons/icon-512.png`
   - Imagem de destaque 1024x500: `store/destaque.png`
   - Capturas do celular: `store/android-*.png` (1080x1920)
6. **Formulários:**
   - *Segurança dos dados*: nenhum dado coletado nem compartilhado (vale enquanto
     as estatísticas anônimas estiverem desligadas no build; ver seção 4).
   - *Classificação do conteúdo (IARC)*: violência de fantasia leve (naves
     atirando em naves, sem sangue). Responda com sinceridade; a nota sai do
     questionário.
   - *Público-alvo*: escolha 13 anos ou mais para não entrar nas regras do
     programa Famílias, ou inclua crianças se quiser (o jogo não tem anúncios,
     compras nem coleta de dados).
   - *Anúncios*: não. *Preço*: gratuito.

## 3. App Store (iPhone)

1. **Conta:** Apple Developer Program (US$ 99 por ano) e um Mac com Xcode 26.
2. **App Store Connect:** *Apps > +*, plataforma iOS, nome "RAJADA", idioma
   principal Português (Brasil), Bundle ID `com.maricobello.rajada`.
3. **Gerar e enviar:**

   ```bash
   cd rajada
   npm install
   npm run cap:ios      # build do jogo + sincroniza + abre o Xcode
   ```

   No Xcode: alvo *App* > *Signing & Capabilities* > escolha o *Team*.
   Suba o *Build* (ex.: 2, 3...). *Product > Archive* > *Distribute App* >
   *App Store Connect*. O build aparece no TestFlight em alguns minutos.
4. **Ficha:**
   - Capturas de 6,9": `store/ios-*.png` (1290x2796, tamanho aceito pela Apple).
   - Ícone: já vai dentro do app (1024x1024, sem transparência).
   - *Privacidade do app*: "Dados não coletados".
   - *Classificação etária*: violência de desenho/fantasia, pouco frequente e
     leve; o questionário calcula a idade.
   - *Criptografia*: o app declara que não usa criptografia própria
     (`ITSAppUsesNonExemptEncryption = NO` no Info.plist), então a pergunta de
     exportação não aparece.
   - URL de suporte e de privacidade: o endereço do site.
5. **Revisão:** a Apple recusa apps que são só um site embrulhado (diretriz 4.2).
   O RAJADA roda offline, tem vibração nativa e não carrega nada da internet;
   se pedirem mais detalhes, explique isso nas notas de revisão.

O workflow do GitHub compila o app de iPhone a cada mudança, para avisar cedo
se algo quebrar. Para enviar automaticamente ao TestFlight seria preciso guardar
certificado e chave da App Store Connect como secrets; isso fica para quando a
conta da Apple existir.

## 4. Estatísticas anônimas (opcional)

Por padrão o jogo não faz nenhuma chamada de rede. Para medir retenção (quantas
partidas, até onde as pessoas chegam), gere o build com um endereço que receba
JSON por POST:

```bash
RAJADA_ANALYTICS_URL=https://seu-endpoint.exemplo/eventos npm run build
```

Aparece então a opção "Enviar estatísticas anônimas" em Ajustes, **desligada**
até o jogador ligar. Eventos: `run_start`, `run_end` (pontos, setor, duração,
abates, cápsulas, causa da queda, nave, habilidade estimada) e `upgrade`, com um
identificador aleatório criado só quando a opção é ligada. Se usar, atualize a
política de privacidade, o formulário de Segurança dos dados (Google) e a
Privacidade do app (Apple).

## 5. Checklist final

- [ ] Site publicado e `/privacidade.html` abrindo
- [ ] Teste fechado da Google Play com 12 testadores por 14 dias
- [ ] AAB assinado enviado; ficha, capturas e formulários preenchidos
- [ ] App criado no App Store Connect; build no TestFlight
- [ ] Capturas, idade, privacidade e notas de revisão na App Store
- [ ] Testado em um Android e um iPhone de verdade (som, vibração, voltar, pausa ao sair)

## Textos para as lojas

**Nome:** RAJADA: Nave Retrô

**Subtítulo (App Store, até 30 caracteres):** Atire, desvie e evolua

**Descrição curta (Google Play, até 80 caracteres):**
Nave retrô de um dedo: pegue cápsulas, turbine as armas e derrube chefes.

**Descrição completa:**

> RAJADA é um jogo de nave retrô para jogar com um dedo. A nave atira sozinha:
> você arrasta para desviar dos tiros e mirar nos inimigos que descem a tela.
>
> • Cápsulas mudam a arma na hora: mais metralhadoras, foguetes teleguiados,
> drones de apoio, escudo e o Pulso que limpa a tela.
> • Cada setor termina com um chefe: o Colosso, a Aranha e o Olho, cada um com
> dois padrões de ataque.
> • Combos, raspões e TURBO: passe raspando nos tiros para encher a barra e
> dobrar o poder de fogo.
> • Hangar com melhorias permanentes e quatro naves para liberar.
> • Missões sob medida, criadas a partir das suas partidas, e patentes de Cadete
> a Lenda.
> • Pixel art, música chiptune e vibração.
>
> Sem anúncios, sem compras, sem cadastro. Funciona offline e o progresso fica
> no seu aparelho.

**Palavras-chave (App Store, até 100 caracteres):**
nave,tiro,arcade,retrô,espacial,pixel,chefe,offline,shooter,shmup
