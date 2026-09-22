-- =====================================================================
-- Plataforma de análise e aquisição de clientes para soluções de energia
-- Migração inicial — MVP (Auditoria, GD por assinatura, Mercado Livre)
-- + estrutura PREVISTA (desativada) para o Módulo 4: Antecipação.
--
-- Segurança: RLS habilitado em todas as tabelas, sem policies públicas.
-- Todo acesso passa pelo backend (service role). Nunca exponha a service role.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Parceiros (comercializadoras, projetos de GD, consultorias, representantes)
-- ---------------------------------------------------------------------
create table if not exists partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'outro' check (kind in ('comercializadora','gd','consultoria','representante','outro')),
  contact_email text,
  contact_phone text,
  commission_rate numeric(6,4),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Leads (CRM)
-- ---------------------------------------------------------------------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  access_token text not null unique,
  name text not null,
  company text,
  cnpj text,
  phone text not null,
  email text not null,
  state text,
  city text,
  bill_range text,
  solar_status text,
  free_market_status text,
  source text not null default 'hero_form',
  stage text not null default 'novo_lead' check (stage in (
    'novo_lead','fatura_recebida','auditoria_processando','auditoria_concluida','qualificado',
    'contato_realizado','reuniao','proposta','negociacao','fechado','perdido')),
  score integer check (score between 0 and 100),
  temperature text check (temperature in ('HOT','WARM','COLD')),
  score_breakdown jsonb,
  processing_status text not null default 'pending',
  processing_error text,
  recommended_solutions text[] not null default '{}',
  opportunities text[] not null default '{}',
  potential_value numeric(14,2),
  potential_commission numeric(14,2),
  partner_id uuid references partners(id) on delete set null,
  owner text,
  notes text,
  intent_signals text[] not null default '{}',
  follow_up_opt_out boolean not null default false,
  consent_at timestamptz not null,
  marketing_consent boolean not null default false,
  utm jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists leads_stage_idx on leads (stage);
create index if not exists leads_temperature_idx on leads (temperature);
create index if not exists leads_created_idx on leads (created_at desc);
create index if not exists leads_phone_idx on leads (phone);
create index if not exists leads_cnpj_idx on leads (cnpj);

-- ---------------------------------------------------------------------
-- Faturas enviadas + dados extraídos
-- ---------------------------------------------------------------------
create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  sha256 text not null,
  status text not null default 'received' check (status in ('received','processing','processed','failed')),
  ocr_provider text,
  ocr_text text,
  extracted jsonb,
  field_meta jsonb,
  validation jsonb,
  extraction_method text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists invoices_lead_idx on invoices (lead_id, created_at desc);
create index if not exists invoices_sha_idx on invoices (sha256);

-- ---------------------------------------------------------------------
-- Diagnósticos (resultado do motor de regras + explicação)
-- ---------------------------------------------------------------------
create table if not exists diagnostics (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete set null,
  audit jsonb not null,
  summary text not null,
  summary_source text not null default 'template',
  finding_texts jsonb not null default '{}',
  engine_version text not null,
  created_at timestamptz not null default now()
);
create index if not exists diagnostics_lead_idx on diagnostics (lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- Histórico de contatos / timeline do lead
-- ---------------------------------------------------------------------
create table if not exists lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  type text not null,
  channel text,
  content text not null,
  meta jsonb,
  author text,
  created_at timestamptz not null default now()
);
create index if not exists lead_activities_lead_idx on lead_activities (lead_id, created_at desc);

-- ---------------------------------------------------------------------
-- Notificações enviadas (e-mail, WhatsApp, webhook)
-- ---------------------------------------------------------------------
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete cascade,
  channel text not null,
  recipient text not null,
  template text not null,
  status text not null,
  provider_response text,
  created_at timestamptz not null default now()
);
create index if not exists notifications_lead_idx on notifications (lead_id);

-- ---------------------------------------------------------------------
-- Sequência de follow-up automatizada
-- ---------------------------------------------------------------------
create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  step integer not null,
  channel text not null,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','skipped','failed','cancelled')),
  sent_at timestamptz,
  message text,
  created_at timestamptz not null default now()
);
create index if not exists follow_ups_due_idx on follow_ups (status, due_at);
create index if not exists follow_ups_lead_idx on follow_ups (lead_id);

-- ---------------------------------------------------------------------
-- Simulações (GD por assinatura / Mercado Livre)
-- ---------------------------------------------------------------------
create table if not exists simulations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references leads(id) on delete set null,
  kind text not null check (kind in ('gd','free_market')),
  input jsonb not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);

-- =====================================================================
-- MÓDULO 4 — ANTECIPAÇÃO DE BENEFÍCIO ECONÔMICO (PREVISTO / DESATIVADO)
-- As tabelas existem para estabilizar o modelo de dados; nenhuma rota
-- ou tela do MVP as utiliza. Ativação via FEATURE_ADVANCE_ENABLED.
-- =====================================================================
create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text,
  updated_at timestamptz not null default now()
);
insert into feature_flags (key, enabled, description)
values ('advance_module', false, 'Módulo 4 — Antecipação de benefício econômico')
on conflict (key) do nothing;

create table if not exists investors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  document text,
  kind text not null default 'fundo' check (kind in ('fundo','fidc','pessoa_juridica','pessoa_fisica','outro')),
  contact_email text,
  capacity_amount numeric(16,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists opportunities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  solution text not null check (solution in ('auditoria','gd_assinatura','mercado_livre','antecipacao')),
  status text not null default 'aberta' check (status in ('aberta','em_analise','proposta','ganha','perdida')),
  estimated_monthly_min numeric(14,2),
  estimated_monthly_max numeric(14,2),
  partner_id uuid references partners(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  partner_id uuid references partners(id) on delete set null,
  kind text not null,
  start_date date,
  end_date date,
  monthly_value numeric(14,2),
  document_path text,
  status text not null default 'rascunho' check (status in ('rascunho','assinado','ativo','encerrado','cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists projected_savings (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  reference_month date not null,
  projected_amount numeric(14,2) not null,
  realized_amount numeric(14,2),
  method text not null default 'engine',
  engine_version text,
  created_at timestamptz not null default now(),
  unique (contract_id, reference_month)
);

create table if not exists advance_offers (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references contracts(id) on delete cascade,
  investor_id uuid references investors(id) on delete set null,
  gross_amount numeric(14,2) not null,
  discount_rate numeric(8,6) not null,
  net_amount numeric(14,2) not null,
  months_covered integer not null,
  status text not null default 'simulada' check (status in ('simulada','ofertada','aceita','liquidada','recusada','expirada')),
  valid_until timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  advance_offer_id uuid references advance_offers(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  direction text not null check (direction in ('in','out')),
  amount numeric(14,2) not null,
  due_date date,
  paid_at timestamptz,
  status text not null default 'pendente' check (status in ('pendente','pago','atrasado','cancelado')),
  created_at timestamptz not null default now()
);

create table if not exists commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid references partners(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  contract_id uuid references contracts(id) on delete set null,
  amount numeric(14,2) not null,
  rate numeric(6,4),
  status text not null default 'prevista' check (status in ('prevista','aprovada','paga','cancelada')),
  due_date date,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS: bloqueia acesso direto via chave anon (somente service role)
-- ---------------------------------------------------------------------
alter table partners enable row level security;
alter table leads enable row level security;
alter table invoices enable row level security;
alter table diagnostics enable row level security;
alter table lead_activities enable row level security;
alter table notifications enable row level security;
alter table follow_ups enable row level security;
alter table simulations enable row level security;
alter table feature_flags enable row level security;
alter table investors enable row level security;
alter table opportunities enable row level security;
alter table contracts enable row level security;
alter table projected_savings enable row level security;
alter table advance_offers enable row level security;
alter table payments enable row level security;
alter table commissions enable row level security;

-- ---------------------------------------------------------------------
-- Storage: bucket privado para faturas
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('invoices', 'invoices', false, 15728640, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
