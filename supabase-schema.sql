-- ============================================================
--  Relationship by Host — Schema Supabase
--  Cola tudo isto no Supabase: SQL Editor -> New query -> Run
--  (workspace partilhado: qualquer utilizador autenticado da
--   equipa pode ver e editar todos os projetos)
-- ============================================================

-- 1) Tabela de projetos (cada linha = um hotel/projeto com os seus templates)
create table if not exists public.projects (
  id          text primary key,                 -- id do projeto gerado pela app (ex.: prj123_...)
  hotel       text not null default 'Novo hotel',
  content     jsonb not null default '{"templates":[]}'::jsonb,  -- { templates: [...] }
  updated_at  timestamptz not null default now(),
  updated_by  text
);

-- 2) (opcional) biblioteca de tags partilhada pela equipa
create table if not exists public.app_settings (
  key    text primary key,   -- ex.: 'tags'
  value  jsonb,
  updated_at timestamptz not null default now()
);

-- 3) Segurança (RLS) — ACESSO DIRETO sem login (a equipa acede pelo link;
--    protegido pela publishable key). Acesso total ao workspace partilhado.
alter table public.projects     enable row level security;
alter table public.app_settings enable row level security;

-- limpar policies antigas se reexecutares
drop policy if exists "projects_read"   on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
drop policy if exists "projects_all"    on public.projects;
drop policy if exists "settings_read"   on public.app_settings;
drop policy if exists "settings_write"  on public.app_settings;
drop policy if exists "settings_update" on public.app_settings;
drop policy if exists "settings_all"    on public.app_settings;

create policy "projects_all" on public.projects     for all to anon, authenticated using (true) with check (true);
create policy "settings_all" on public.app_settings for all to anon, authenticated using (true) with check (true);

-- 4) atualizar updated_at automaticamente
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

drop trigger if exists trg_projects_touch on public.projects;
create trigger trg_projects_touch before update on public.projects
  for each row execute function public.touch_updated_at();

-- 5) (opcional) Realtime — para vários colegas verem alterações em tempo real
alter publication supabase_realtime add table public.projects;
