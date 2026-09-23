-- Arquivos das faturas guardados no próprio Postgres (dispensa a service role do Storage)
create table if not exists invoice_files (
  key text primary key,
  mime_type text not null,
  content bytea not null,
  created_at timestamptz not null default now()
);
alter table invoice_files enable row level security;
revoke all on invoice_files from anon, authenticated;

-- Papel dedicado do app (conexão direta via pooler). Crie antes, fora do versionamento:
--   create role aferi_app login password '<senha forte>' bypassrls;
grant usage on schema public to aferi_app;
grant select, insert, update, delete on all tables in schema public to aferi_app;
grant usage, select on all sequences in schema public to aferi_app;
alter default privileges in schema public grant select, insert, update, delete on tables to aferi_app;
alter default privileges in schema public grant usage, select on sequences to aferi_app;
