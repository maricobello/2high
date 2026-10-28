# RAJADA: lançamento (site, Google Play e App Store)

Tudo o que dá para preparar sem as suas contas já está pronto: jogo, ícones,
capturas, textos, site com privacidade e suporte, e workflows que geram os
pacotes das lojas. Dá para fazer o resto pelo celular, sem computador e sem Mac.
Este guia cobre o que só você pode fazer.

**Links do jogo**

- Site: https://rajada-jogo.vercel.app
- Privacidade: https://rajada-jogo.vercel.app/privacidade.html
- Suporte: https://rajada-jogo.vercel.app/suporte.html
- APK de teste para Android: https://github.com/maricobello/2high/releases/tag/rajada-apk

**Onde está cada coisa**

- Textos da ficha: no fim deste guia
- Imagens: `rajada/store/` e `rajada/icons/icon-512.png`
- E-mail de contato das páginas: `rajada/store/config.json`

**Custos:** Apple US$ 99 por ano; Google US$ 25 uma vez. Se você já tem as contas
do PRUMO, elas valem para o RAJADA.

---

## Passo 0: preparar (uma vez)

1. **E-mail de contato.** As lojas pedem um contato na página de suporte. No
   GitHub, abra `rajada/store/config.json`, toque no lápis, preencha `"email"`
   (pode ser o mesmo do PRUMO) e salve. O site se atualiza sozinho quando a
   mudança chega no `main`.
2. **Levar o jogo para o `main`.** O GitHub só mostra o botão "Run workflow" de
   workflows que estão no branch principal. Junte o branch `claude/jogo-rajada`
   no `main` pelo Pull Request.

### Como criar um segredo no GitHub

Repositório › **Settings** › **Secrets and variables** › **Actions** ›
**New repository secret**. O nome tem que ser exatamente o indicado.

### Como rodar um workflow

Repositório › **Actions** › **Jogo RAJADA · Lojas** › **Run workflow** › escolha
a tarefa › **Run workflow**. Quando terminar (bolinha verde), abra a execução e
baixe o arquivo em **Artifacts**.

---

## Google Play

### 1. Conta

Crie a conta em https://play.google.com/console (US$ 25, verificação de
identidade com documento). Pode levar alguns dias.

> Contas **pessoais** novas precisam fazer um **teste fechado com pelo menos 12
> pessoas por 14 dias** antes de publicar para todos. Comece o passo 5 cedo e
> chame amigos para testar.

### 2. Chave de envio (uma vez, só do RAJADA)

1. Crie o segredo `RAJADA_KEYSTORE_PASSWORD` com uma senha longa (12 caracteres
   ou mais). **Anote a senha.**
2. Rode o workflow com a tarefa **gerar-chave-android**.
3. Baixe o artefato `chave-android`. Ele fica disponível por 1 dia e traz dois
   arquivos:
   - `rajada-upload.jks`: guarde junto com a senha num lugar seguro, como o
     Google Drive. Sem ela você não atualiza o app.
   - `RAJADA_KEYSTORE_BASE64.txt`: abra, copie todo o texto e crie o segredo
     `RAJADA_KEYSTORE_BASE64` com ele.
4. Apague o artefato na página da execução (ícone de lixeira). O repositório é
   público; a senha longa protege a chave, mas não precisa deixar o arquivo lá.

Já tem uma chave criada no computador? Use-a no lugar: `RAJADA_KEYSTORE_BASE64`
com o arquivo em base64, `RAJADA_KEYSTORE_PASSWORD`, `RAJADA_KEY_ALIAS` com o
apelido e, se a senha da chave for outra, `RAJADA_KEY_PASSWORD`.

### 3. Gerar o pacote

Rode o workflow com a tarefa **android**. Baixe `rajada-aab-N` e descompacte
para obter o `app-release.aab`.

### 4. Criar o app no Play Console

**Criar app:**

| Campo | Valor |
|---|---|
| Nome | RAJADA: Nave Retrô |
| Idioma padrão | Português (Brasil) |
| Tipo | Jogo |
| Preço | Gratuito |

Aceite as declarações.

No **Painel**, complete "Configurar o app":

| Item | Resposta |
|---|---|
| Política de privacidade | link de privacidade acima |
| Acesso ao app | todas as funções disponíveis sem restrição |
| Anúncios | não contém |
| Classificação do conteúdo | questionário: categoria Jogo; violência de fantasia leve (naves atirando em naves, sem sangue nem pessoas); "Não" para o resto |
| Público-alvo | 13 a 15, 16 a 17, 18+ |
| Segurança dos dados | não coleta nem compartilha dados |
| Apps governamentais, financeiros, de saúde | não |

**Ficha principal da loja:** textos no fim deste guia; categoria **Arcade**. As
imagens:

| Campo | Arquivo |
|---|---|
| Ícone | `icons/icon-512.png` |
| Recurso gráfico | `store/destaque.png` |
| Capturas de tela do celular | `store/android-1-armas.png` a `store/android-5-missoes.png` |

### 5. Teste fechado

1. **Testar › Teste fechado › Criar faixa** (ou use a faixa "Alpha").
2. **Criar versão.** Aceite a **Assinatura de apps do Google Play** e envie o
   `app-release.aab`. Notas da versão: "Primeira versão."
3. Em **Testadores**, crie uma lista com os e-mails (Gmail) de 12 pessoas ou
   mais e envie o link de participação para elas.
4. Revise e publique a faixa. Os testadores instalam pela Play Store.

Antes disso, quem quiser já pode testar com o APK de teste (link no topo): no
Android, abra o link, baixe `rajada.apk` e permita instalar apps desta fonte.

### 6. Produção

Depois de 14 dias de teste, vá ao **Painel**, clique em **Solicitar acesso à
produção** e responda o formulário. Com o acesso liberado:

1. **Produção › Criar versão**: use o mesmo AAB ou um novo.
2. **Enviar para revisão.** A revisão leva de algumas horas a alguns dias.

---

## App Store (Apple), sem Mac

### 1. Conta

Inscreva-se em https://developer.apple.com/programs (US$ 99 por ano). Você
precisa de um Apple ID com verificação em duas etapas. A aprovação leva de 1 a 2
dias.

### 2. Registrar o identificador do app

https://developer.apple.com/account › **Certificates, IDs & Profiles** ›
**Identifiers** › **+** › **App IDs** › **App**:

- Description: `RAJADA`
- Bundle ID: **Explicit**, `com.maricobello.rajada`
- **Continue › Register**

### 3. Criar o app no App Store Connect

https://appstoreconnect.apple.com › **Apps** › **+** › **Novo app**:

| Campo | Valor |
|---|---|
| Plataforma | iOS |
| Nome | RAJADA: Nave Retrô |
| Idioma | Português (Brasil) |
| Bundle ID | com.maricobello.rajada |
| SKU | rajada |

### 4. Segredos da Apple no GitHub (uma vez por conta)

Se você já criou estes segredos para o PRUMO, pule: eles valem para os dois.

1. **Team ID:** em developer.apple.com/account › **Membership details**, copie
   o Team ID e crie o segredo `APPLE_TEAM_ID`.
2. **Chave da API:** no App Store Connect, vá em **Usuários e acesso** ›
   **Integrações** › **App Store Connect API** › **Chaves da equipe** › **+**.
   - Nome: `GitHub`
   - Acesso: **Admin**. É necessário para a Apple assinar o app na nuvem.
3. Baixe o arquivo `.p8`. Isso só é possível uma vez; guarde-o.
4. Crie os segredos:
   - `APPSTORE_API_KEY_ID`: o "ID da chave" mostrado na lista.
   - `APPSTORE_API_ISSUER_ID`: o "ID do emissor", no topo da página.
   - `APPSTORE_API_PRIVATE_KEY`: abra o `.p8` num editor de texto e cole todo o
     conteúdo, incluindo as linhas `-----BEGIN PRIVATE KEY-----` e
     `-----END PRIVATE KEY-----`.

### 5. Compilar e enviar

1. Rode o workflow com a tarefa **ios**. Leva cerca de 15 minutos.
2. Entre 10 e 30 minutos depois, o build aparece em **App Store Connect › seu
   app › TestFlight**.
3. Para testar no seu iPhone: em TestFlight › **Testes internos**, adicione o
   seu e-mail e instale o app **TestFlight** no celular.

### 6. Ficha e envio para revisão

No App Store Connect › seu app › versão **1.0.0**:

1. **Capturas de tela iPhone 6,9"**: envie `store/ios-1-armas.png` a
   `store/ios-5-missoes.png` (1290x2796).
2. **Textos** (fim deste guia): subtítulo, texto promocional, descrição,
   palavras-chave, URL de suporte e URL de marketing (o site).
3. **Build**: selecione o build que apareceu no TestFlight.
4. **Informações gerais do app**:
   - Categoria: Jogos (Ação e Casual).
   - Classificação etária: no questionário, marque violência de desenho ou
     fantasia como pouco frequente ou leve e "Não" para o resto. O resultado
     deve ficar em 9+.
   - Copyright: 2026 seu nome.
5. **Privacidade do app**:
   - URL da política: o link de privacidade acima.
   - Coleta de dados: **"Não, não coletamos dados deste app"**.
6. **Preço e disponibilidade**: gratuito, em todos os países.
7. **Informações para a revisão**: seu nome, telefone e e-mail. Nas notas, cole
   o texto "Notas para a revisão da Apple" do fim deste guia. Não precisa de
   conta de demonstração.
8. **Adicionar para revisão › Enviar.** A revisão costuma levar de 24 a 48
   horas.

---

## Atualizações futuras

1. Mude a versão em `rajada/package.json`, por exemplo `"version": "1.0.1"`. Ela
   vale para o site, o Android e o iPhone.
2. Rode o workflow com a tarefa **android-e-ios**. O número do build sobe
   sozinho.
3. Na Play: crie uma nova versão com o novo AAB. Na Apple: crie a versão 1.0.1 e
   selecione o novo build.

O site se atualiza sozinho a cada mudança no `main` (projeto `rajada-jogo` na
Vercel). O APK de teste também.

## Estatísticas anônimas (opcional)

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

## Com computador (opcional)

Quem tiver Android Studio ou um Mac com Xcode pode abrir os projetos nativos:

```bash
cd rajada
npm install
npm run cap:android  # build do jogo + sincroniza + abre o Android Studio
npm run cap:ios      # o mesmo para o Xcode
```

## Se algo der errado

Workflow com bolinha vermelha: abra a execução, toque no passo com erro e copie
o texto. Mande para o Claude junto com a pergunta.

| Mensagem | O que fazer |
|---|---|
| "Falta um segredo..." | o nome do segredo está diferente ou vazio |
| "Crie antes o segredo RAJADA_KEYSTORE_PASSWORD..." | a senha precisa ter 12 caracteres ou mais |
| "No profiles for 'com.maricobello.rajada' were found" ou erro de certificado | a chave da API precisa de acesso **Admin**, e o Bundle ID do passo 2 precisa existir |
| Upload recusado por versão repetida | rode o workflow de novo (o número do build sobe a cada execução) |
| Android recusa instalar o APK de teste por cima | desinstale a versão anterior: cada APK de teste sai com uma chave de teste nova |

## Checklist final

- [ ] E-mail em `store/config.json`; site, privacidade e suporte abrindo
- [ ] Teste fechado da Google Play com 12 testadores por 14 dias
- [ ] AAB assinado enviado; ficha, capturas e formulários preenchidos
- [ ] App criado no App Store Connect; build no TestFlight
- [ ] Capturas, idade, privacidade e notas de revisão na App Store
- [ ] Testado em um Android e um iPhone de verdade (som, vibração, voltar, pausa ao sair)

## Textos para as lojas

**Nome:** RAJADA: Nave Retrô

**Subtítulo (App Store, até 30 caracteres):** Atire, desvie e evolua

**Texto promocional (App Store, até 170 caracteres):**
Nave retrô de um dedo: armas que evoluem sem limite, cápsulas raras e 6 chefes.
Sem anúncios, sem compras e funciona offline.

**Descrição curta (Google Play, até 80 caracteres):**
Nave retrô de um dedo: armas que evoluem sem limite, cápsulas raras e 6 chefes.

**Descrição completa:**

> RAJADA é um jogo de nave retrô para jogar com um dedo. A nave atira sozinha:
> você arrasta para desviar dos tiros e mirar nos inimigos que descem a tela.
>
> • Cápsulas mudam a arma na hora: mais metralhadoras, foguetes teleguiados,
> drones de apoio, escudo e o Pulso que limpa a tela.
> • Armas sem nível máximo: a cada 5 níveis a metralhadora ganha uma forma nova
> (Leque, Pesada, Perfurante, Caçadora, Raio, Tempestade, Estelar) e o tiro
> muda de cor.
> • Cápsulas comuns, raras, épicas e lendárias, com garantia contra azar.
> • Seis chefes em pixel art de alta definição: Colosso, Aranha, Olho, Serpente,
> Forja e Rainha. Abaixo da metade da vida a armadura quebra e o ataque muda.
> • Setores sem fim: os inimigos ficam mais resistentes e, a cada volta pelos 6
> setores, ganham cores e ataques novos.
> • Combos, raspões e TURBO: passe raspando nos tiros para encher a barra e
> dobrar o poder de fogo.
> • Hangar com melhorias permanentes e quatro naves para liberar.
> • Missões sob medida, criadas a partir das suas partidas, e patentes de Cadete
> a Lenda.
> • Pixel art, música chiptune e vibração.
>
> Sem anúncios, sem compras, sem cadastro. Funciona offline e o progresso fica
> no seu aparelho.

**Novidades da versão 1.1 (Google Play e App Store, até 500 caracteres):**

> Evolução infinita: as armas não têm mais nível máximo, com forma nova e tiro
> de outra cor a cada 5 níveis. Cápsulas raras, épicas e lendárias. Três chefes
> novos (Serpente, Forja e Rainha) e todos os seis em alta definição. Começo com
> mais inimigos, elites a partir do setor 4 e a Coleção, com os chefes e as
> formas das armas que você já viu.

**Palavras-chave (App Store, até 100 caracteres):**
nave,tiro,arcade,retrô,espacial,pixel,chefe,offline,shooter,shmup

**Notas para a revisão da Apple:**

> RAJADA é um jogo completo que roda dentro do app, sem internet: o código, as
> imagens e os sons vão no pacote e nada é carregado de um site. Usa vibração
> nativa, pausa sozinho ao sair do app e salva o progresso no aparelho. Não tem
> login, compras nem anúncios. Para jogar, arraste o dedo na tela; a nave atira
> sozinha.
