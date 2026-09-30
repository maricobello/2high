-- Uso da IA: uma linha por chamada ao modelo (painel /admin/ia). Sem conteúdo da fatura.
create table if not exists ai_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid references leads(id) on delete set null,
  task text not null,
  provider text not null,
  model text not null,
  ok boolean not null,
  latency_ms integer not null,
  attempts integer not null default 1,
  prompt_tokens integer,
  completion_tokens integer,
  total_tokens integer,
  error text
);
create index if not exists ai_usage_created_at_idx on ai_usage (created_at desc);
create index if not exists ai_usage_lead_idx on ai_usage (lead_id);
alter table ai_usage enable row level security;
revoke all on ai_usage from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'aferi_app') then
    grant select, insert, update, delete on ai_usage to aferi_app;
  end if;
end $$;
