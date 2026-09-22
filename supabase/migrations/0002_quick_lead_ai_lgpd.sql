-- Captura em 2 etapas, lembretes de fatura, atendimento com IA e LGPD

-- Tipo de sequência de follow-up
alter table follow_ups add column if not exists kind text not null default 'diagnostic'
  check (kind in ('diagnostic','invoice_reminder'));

-- E-mail normalizado para localizar titular em solicitações LGPD
create index if not exists leads_email_idx on leads (lower(email));

-- Solicitações de titulares (art. 18 da LGPD)
create table if not exists privacy_requests (
  id uuid primary key default gen_random_uuid(),
  protocol text not null unique,
  name text not null,
  email text not null,
  phone text,
  type text not null check (type in ('acesso','correcao','exclusao','revogacao','portabilidade','informacao')),
  message text,
  status text not null default 'aberta' check (status in ('aberta','em_andamento','concluida','recusada')),
  lead_id uuid references leads(id) on delete set null,
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists privacy_requests_status_idx on privacy_requests (status, created_at desc);
alter table privacy_requests enable row level security;
