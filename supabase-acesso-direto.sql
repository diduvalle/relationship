-- ============================================================
--  Relationship by Host — ACESSO DIRETO (sem login)
--  Corre isto no Supabase: SQL Editor -> New query -> Run
--  Permite à app ler/escrever os projetos sem autenticação
--  (a equipa acede pelo link; protegido só pela publishable key).
-- ============================================================

-- substituir as regras antigas (que exigiam login) por acesso direto
drop policy if exists "projects_read"   on public.projects;
drop policy if exists "projects_insert" on public.projects;
drop policy if exists "projects_update" on public.projects;
drop policy if exists "projects_delete" on public.projects;
drop policy if exists "projects_all"    on public.projects;

create policy "projects_all"
  on public.projects
  for all
  to anon, authenticated
  using (true)
  with check (true);

-- (idem para a tabela opcional de settings, caso a uses)
drop policy if exists "settings_read"   on public.app_settings;
drop policy if exists "settings_write"  on public.app_settings;
drop policy if exists "settings_update" on public.app_settings;
drop policy if exists "settings_all"    on public.app_settings;

create policy "settings_all"
  on public.app_settings
  for all
  to anon, authenticated
  using (true)
  with check (true);
