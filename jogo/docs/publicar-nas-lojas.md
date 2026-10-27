# Guia: publicar o PRUMO na App Store e na Google Play

Tudo o que dá para preparar sem as suas contas já está pronto: app, ícones, capturas,
textos, site com privacidade e suporte, e workflows que geram os pacotes das lojas.
Este guia cobre o que só você pode fazer.

**Links do jogo**

- Site: https://prumo-jogo.vercel.app
- Privacidade: https://prumo-jogo.vercel.app/privacidade.html
- Suporte: https://prumo-jogo.vercel.app/suporte.html

**Onde está cada coisa**

- Textos da ficha: `jogo/loja/textos.md`
- Imagens: `jogo/loja/`

**Custos:** Apple US$ 99 por ano; Google US$ 25 uma vez.

---

## Passo 0: preparar (uma vez)

1. **E-mail do jogo.** Crie o e-mail (ex.: prumo.jogo@gmail.com). No GitHub, abra
   `jogo/loja/config.json`, clique no lápis, preencha `"email"` e salve. Depois peça
   ao Claude para republicar o site, ou conecte o Git na Vercel (item 3) e ele se
   atualiza sozinho.
2. **Levar o jogo para o `main`.** O GitHub só mostra o botão "Run workflow" de
   workflows que estão no branch principal. Junte o branch `claude/jogo-prumo` no
   `main` (pelo Pull Request).
3. **(Opcional) Site sempre atualizado.** Na Vercel, projeto `prumo-jogo` › Settings ›
   Git › Connect Git Repository › `maricobello/2high`. O diretório `jogo` já está
   configurado.

### Como criar um segredo no GitHub

Repositório › **Settings** › **Secrets and variables** › **Actions** ›
**New repository secret**. O nome tem que ser exatamente o indicado.

### Como rodar um workflow

Repositório › **Actions** › **Jogo PRUMO · Lojas** › **Run workflow** › escolha a
tarefa › **Run workflow**. Quando terminar (bolinha verde), abra a execução e baixe o
arquivo em **Artifacts**.

---

## Google Play

### 1. Conta

Crie a conta em https://play.google.com/console (US$ 25, verificação de identidade
com documento). Pode levar alguns dias.

> Contas **pessoais** novas precisam fazer um **teste fechado com pelo menos 12
> pessoas por 14 dias** antes de publicar para todos. Comece o passo 5 cedo e chame
> amigos para testar.

### 2. Chave de envio (uma vez)

1. Crie o segredo `ANDROID_KEYSTORE_PASSWORD` com uma senha forte (6 caracteres ou
   mais). **Anote a senha.**
2. Rode o workflow com a tarefa **gerar-chave-android**.
3. Baixe o artefato `chave-android`. Ele fica disponível por 1 dia e traz dois arquivos:
   - `prumo-upload.jks`: guarde junto com a senha num lugar seguro, como o Google
     Drive. Sem ela você não atualiza o app.
   - `ANDROID_KEYSTORE_BASE64.txt`: abra, copie todo o texto e crie o segredo
     `ANDROID_KEYSTORE_BASE64` com ele.

### 3. Gerar o pacote

Rode o workflow com a tarefa **android**. Baixe `prumo-aab-N` e descompacte para
obter o `app-release.aab`.

### 4. Criar o app no Play Console

**Criar app:**

| Campo | Valor |
|---|---|
| Nome | PRUMO: Torre de Blocos |
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
| Classificação do conteúdo | questionário: categoria Jogo, "Não" para tudo |
| Público-alvo | 13 a 15, 16 a 17, 18+ |
| Segurança dos dados | não coleta nem compartilha dados |
| Apps governamentais, financeiros, de saúde | não |

**Ficha principal da loja:** copie de `loja/textos.md`. As imagens:

| Campo | Arquivo |
|---|---|
| Ícone | `icone-512.png` |
| Recurso gráfico | `destaque-play.png` |
| Capturas de tela do celular | `capturas/android/1..5.png` |

### 5. Teste fechado

1. **Testar › Teste fechado › Criar faixa** (ou use a faixa "Alpha").
2. **Criar versão.** Aceite a **Assinatura de apps do Google Play** e envie o
   `app-release.aab`. Notas da versão: "Primeira versão."
3. Em **Testadores**, crie uma lista com os e-mails (Gmail) de 12 pessoas ou mais e
   envie o link de participação para elas.
4. Revise e publique a faixa. Os testadores instalam pela Play Store.

### 6. Produção

Depois de 14 dias de teste, vá ao **Painel**, clique em **Solicitar acesso à produção**
e responda o formulário. Com o acesso liberado:

1. **Produção › Criar versão**: use o mesmo AAB ou um novo.
2. **Enviar para revisão.** A revisão leva de algumas horas a alguns dias.

---

## App Store (Apple), sem Mac

### 1. Conta

Inscreva-se em https://developer.apple.com/programs (US$ 99 por ano). Você precisa de
um Apple ID com verificação em duas etapas. A aprovação leva de 1 a 2 dias.

### 2. Registrar o identificador do app

https://developer.apple.com/account › **Certificates, IDs & Profiles** ›
**Identifiers** › **+** › **App IDs** › **App**:

- Description: `PRUMO`
- Bundle ID: **Explicit**, `com.maricobello.prumo`
- **Continue › Register**

### 3. Criar o app no App Store Connect

https://appstoreconnect.apple.com › **Apps** › **+** › **Novo app**:

| Campo | Valor |
|---|---|
| Plataforma | iOS |
| Nome | PRUMO: Torre de Blocos |
| Idioma | Português (Brasil) |
| Bundle ID | com.maricobello.prumo |
| SKU | prumo |

### 4. Segredos da Apple no GitHub (uma vez)

1. **Team ID:** em developer.apple.com/account › **Membership details**, copie o Team
   ID e crie o segredo `APPLE_TEAM_ID`.
2. **Chave da API:** no App Store Connect, vá em **Usuários e acesso** ›
   **Integrações** › **App Store Connect API** › **Chaves da equipe** › **+**.
   - Nome: `GitHub`
   - Acesso: **Admin**. É necessário para a Apple assinar o app na nuvem.
3. Baixe o arquivo `.p8`. Isso só é possível uma vez; guarde-o.
4. Crie os segredos:
   - `APPSTORE_API_KEY_ID`: o "ID da chave" mostrado na lista.
   - `APPSTORE_API_ISSUER_ID`: o "ID do emissor", no topo da página.
   - `APPSTORE_API_PRIVATE_KEY`: abra o `.p8` no Bloco de Notas e cole todo o
     conteúdo, incluindo as linhas `-----BEGIN PRIVATE KEY-----` e
     `-----END PRIVATE KEY-----`.

### 5. Compilar e enviar

1. Rode o workflow com a tarefa **ios**. Leva cerca de 15 minutos.
2. Entre 10 e 30 minutos depois, o build aparece em **App Store Connect › seu app ›
   TestFlight**.
3. Para testar no seu iPhone: em TestFlight › **Testes internos**, adicione o seu e-mail
   e instale o app **TestFlight** no celular.

### 6. Ficha e envio para revisão

No App Store Connect › seu app › versão **1.0.0**:

1. **Capturas de tela iPhone 6,9"**: envie `loja/capturas/iphone/1..5.png`.
2. **Textos** (`loja/textos.md`): texto promocional, descrição, palavras-chave, URL de
   suporte e URL de marketing (o site).
3. **Build**: selecione o build que apareceu no TestFlight.
4. **Informações gerais do app**:
   - Categoria: Jogos (Casual e Quebra-cabeça).
   - Classificação etária: responda o questionário; resultado 4+.
   - Copyright: 2026 seu nome.
5. **Privacidade do app**:
   - URL da política: o link de privacidade acima.
   - Coleta de dados: **"Não, não coletamos dados deste app"**.
6. **Preço e disponibilidade**: gratuito, em todos os países.
7. **Informações para a revisão**: seu nome, telefone e e-mail. Nas notas, cole o
   texto de `loja/textos.md`. Não precisa de conta de demonstração.
8. **Adicionar para revisão › Enviar.** A revisão costuma levar de 24 a 48 horas.

---

## Atualizações futuras

1. Mude a versão em `jogo/package.json`, por exemplo `"version": "1.0.1"`. Ela vale
   para Android e iOS.
2. Rode o workflow com a tarefa **android-e-ios**. O número do build sobe sozinho.
3. Na Play: crie uma nova versão com o novo AAB. Na Apple: crie a versão 1.0.1 e
   selecione o novo build.

## Se algo der errado

Workflow com bolinha vermelha: abra a execução, clique no passo com erro e copie o
texto. Mande para o Claude junto com a pergunta.

Mensagens comuns:

| Mensagem | O que fazer |
|---|---|
| "Falta um segredo..." | o nome do segredo está diferente ou vazio |
| "No profiles for 'com.maricobello.prumo' were found" ou erro de certificado | a chave da API precisa de acesso **Admin**, e o Bundle ID do passo 2 precisa existir |
| Upload recusado por versão repetida | rode o workflow de novo (o número do build sobe a cada execução) |
