-- Segredos de configuração lidos só pelo backend (ex.: GROQ_API_KEY quando não
-- estiver nas variáveis de ambiente). Nunca coloque valores reais neste arquivo.
create table if not exists app_secrets (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table app_secrets enable row level security;
revoke all on app_secrets from anon, authenticated;
-- insert into app_secrets (key, value) values ('GROQ_API_KEY', '<sua chave>');
