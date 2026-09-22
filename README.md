# Aferi — Inteligência de energia para empresas (MVP)

Plataforma SaaS B2B de **análise e aquisição de clientes para soluções de energia**:

1. **Auditoria de fatura** — upload → leitura → validação → motor de regras → Raio-X
2. **GD por assinatura** — simulador com faixa de economia estimada
3. **Mercado Livre de Energia** — análise preliminar de perfil
4. **Antecipação de benefício econômico** — *prevista* (banco, tipos e feature flag), **desativada** no lançamento

O nome da marca é configurável em `NEXT_PUBLIC_BRAND_NAME` (padrão: “Aferi”).

---

## Princípio central

| Camada | Responsável | Pode decidir valores? |
|---|---|---|
| Leitura do documento (OCR/visão) e extração de campos | IA (Groq) + regex | Não — só **interpreta** |
| Conferência dos números extraídos | Código determinístico (o número precisa existir no texto) | — |
| Cálculos, regras, validações, estimativas, score | **Motor determinístico** (`src/modules/rules-engine`, `simulators`, `scoring`) | **Sim** |
| Explicação em linguagem simples, resumo, follow-up, intenção | IA | Não — texto passa por **guardas** |

As guardas (`src/modules/llm/guards.ts`) reprovam textos da IA que contenham números que não vieram do motor ou linguagem proibida (“garantimos”, “cobrando errado”, “roubado”, “elegível”…). Se reprovar, entra o texto padrão. Sem `GROQ_API_KEY` o sistema funciona 100% com regras e templates.

## Pipeline automático (a cada fatura enviada)

```
Upload → armazenamento privado → OCR/texto (unpdf | OCR.space | Groq Vision)
→ extração (regex + IA) → conferência anti-alucinação → validação
→ motor de regras (8 verificações) → GD + Mercado Livre → explicação (IA com guardas)
→ score 0–100 (HOT/WARM/COLD) → CRM (estágio automático)
→ confirmação ao lead (e-mail/WhatsApp) → alerta ao time → webhook CRM externo
→ sequência de follow-up (4 mensagens, geradas por IA, canceladas quando o time assume)
```

O processamento roda em segundo plano (`after()` do Next.js); a página do diagnóstico acompanha o progresso. Falhas de OCR/IA degradam para o caminho determinístico: o lead **sempre** recebe diagnóstico.

Respostas no WhatsApp (webhook de entrada) são classificadas (regras + IA): “SAIR” desliga a automação; interesse/reunião move o lead para *Qualificado*, cancela o follow-up e alerta o time.

## Módulos

```
src/
  app/(site)/            páginas públicas (home, Raio-X, GD, Mercado Livre, LGPD)
  app/admin/             painel protegido (Kanban, leads, detalhe, parceiros, integrações)
  app/api/               API REST (leads, diagnósticos, simulações, admin, cron, webhooks, v1)
  modules/
    invoice/             modelo canônico, parser regex, fusão regex+IA, validação
    ocr/                 leitura de PDF/imagem, verificação de assinatura do arquivo
    llm/                 provedor desacoplado (Groq/OpenAI-compatível), tarefas, guardas
    rules-engine/        motor de auditoria + parâmetros versionados (ENGINE_VERSION)
    simulators/          GD por assinatura, Mercado Livre
    scoring/             lead scoring explicável
    crm/                 estágios, sinais de intenção, eventos
    notifications/       e-mail (Resend), WhatsApp (Meta/webhook), webhooks, follow-up
    pipeline/            orquestrador e visão pública do diagnóstico
    db/                  repositório (Supabase | local para dev)
    storage/             faturas (Supabase Storage privado | disco local)
    integrations/aneel   dados abertos ANEEL (preparado, fora do caminho crítico)
    future/advance/      módulo 4 (tipos + flag, desativado)
supabase/migrations/     schema completo (inclui entidades futuras) com RLS
```

Premissas comerciais/regulatórias (tolerância de demanda, Fio B da Lei 14.300, faixas de desconto de GD/ACL, comissões) ficam em `src/modules/rules-engine/parameters.ts` — **calibre com o time técnico** antes de operar.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha ADMIN_EMAIL, ADMIN_PASSWORD, AUTH_SECRET
npm run dev                  # http://localhost:3000  ·  painel: /admin
```

Sem Supabase, os dados ficam em `.data/` (apenas desenvolvimento). Para gerar uma fatura de teste:

```bash
node scripts/make-sample-pdf.mjs tests/fixtures/fatura-grupo-a.txt fatura.pdf
```

Qualidade: `npm test` (Vitest), `npm run lint`, `npm run typecheck`, `npm run build`.

## Deploy (Vercel + Supabase)

1. Crie um projeto Supabase e rode `supabase/migrations/0001_init.sql` (cria tabelas, RLS e o bucket privado `invoices`).
2. Na Vercel, importe o repositório e configure as variáveis do `.env.example` (no mínimo `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_*`, `AUTH_SECRET`, `GROQ_API_KEY`, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_COMMERCIAL_WHATSAPP`).
3. `vercel.json` agenda `/api/cron/follow-ups` diariamente (limite do plano Hobby). No plano Pro, aumente a frequência (ex.: `0 * * * *`) ou use um agendador externo com `Authorization: Bearer $CRON_SECRET`.
4. WhatsApp: `WHATSAPP_PROVIDER=meta` (Cloud API; fora da janela de 24h exige template aprovado em `META_WHATSAPP_TEMPLATE`) ou `webhook` (Z-API, Evolution API, n8n). Webhook de entrada: `/api/webhooks/whatsapp`.

Limite de upload: ~4 MB (limite de corpo das funções da Vercel). Fotos são comprimidas no navegador antes do envio.

## Segurança e LGPD

- Chaves só no servidor (`src/lib/env.ts` importa `server-only`; nada secreto usa `NEXT_PUBLIC_`).
- Arquivo validado pela assinatura binária; bucket privado; acesso do admin via URL assinada de curta duração.
- Página do diagnóstico acessada por token aleatório (não enumerável); não expõe score, notas nem texto da fatura.
- Painel com cookie HMAC `httpOnly` + verificação no `proxy.ts` e em cada rota; rate limit em formulários e login; honeypot anti-bot.
- Consentimento registrado (`consent_at`), opt-out de mensagens, política de privacidade e termos.

## Endpoints

| Método | Rota | Uso |
|---|---|---|
| POST | `/api/leads` | formulário do hero (multipart com a fatura) |
| GET | `/api/diagnostics/:token` | status + Raio-X público |
| POST | `/api/leads/:token/invoice` | envio tardio da fatura |
| POST | `/api/leads/:token/intent` | CTAs “quero proposta / análise comercial” |
| GET | `/api/leads/:token/whatsapp` | registra clique e redireciona ao WhatsApp |
| POST | `/api/simulations/{gd,free-market,lead}` | simuladores e captura de lead |
| GET/POST | `/api/v1/leads` | API para parceiros (Bearer `API_TOKEN`) |
| GET/POST | `/api/webhooks/whatsapp` | mensagens recebidas (Meta ou genérico) |
| GET | `/api/cron/follow-ups` | processamento da sequência (Bearer `CRON_SECRET`) |
| * | `/api/admin/*` | CRM (sessão de administrador) |
| GET | `/api/health` | status das integrações |

## Próximos passos sugeridos

- Supabase Auth com perfis (admin, vendedor, parceiro) no lugar da senha única.
- Fila dedicada (ex.: Inngest/QStash) para alto volume de processamento e follow-up.
- Rate limit distribuído (Upstash Redis).
- Calibrar `parameters.ts` e ampliar o parser com faturas reais de cada distribuidora (os testes em `tests/` servem de base).
