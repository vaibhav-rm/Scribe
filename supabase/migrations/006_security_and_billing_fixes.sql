-- ---------------------------------------------------------------
-- 006: Security and schema fixes for existing projects
-- ---------------------------------------------------------------
-- Safe to apply after 001-005. Repairs:
--   1. Recursive RLS policies that queried public.profiles from inside
--      public.profiles (causing "infinite recursion detected in policy").
--   2. template_versions.updated_at, which the updated-at trigger needs.
--   3. Recreates the admin-aware policies using a SECURITY DEFINER helper.
-- ---------------------------------------------------------------

alter table public.template_versions
  add column if not exists updated_at timestamptz not null default now();

-- Keep moderation notes separate from the template description instead of
-- overwriting the owner's description with a rejection reason.
alter table public.templates
  add column if not exists review_notes text;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Profiles
drop policy if exists profiles_own on public.profiles;
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_own on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);
create policy profiles_admin_all on public.profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- Colleges / departments
drop policy if exists colleges_read_all on public.colleges;
drop policy if exists colleges_admin_write on public.colleges;
create policy colleges_read_all on public.colleges
  for select using (auth.role() = 'authenticated');
create policy colleges_admin_write on public.colleges
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists departments_read_all on public.departments;
drop policy if exists departments_admin_write on public.departments;
create policy departments_read_all on public.departments
  for select using (auth.role() = 'authenticated');
create policy departments_admin_write on public.departments
  for all using (public.is_admin()) with check (public.is_admin());

-- Projects
drop policy if exists projects_owner on public.projects;
drop policy if exists projects_admin_all on public.projects;
create policy projects_owner on public.projects
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy projects_admin_all on public.projects
  for all using (public.is_admin()) with check (public.is_admin());

-- Resources
drop policy if exists project_resources_owner on public.project_resources;
drop policy if exists project_resources_admin_all on public.project_resources;
create policy project_resources_owner on public.project_resources
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy project_resources_admin_all on public.project_resources
  for all using (public.is_admin()) with check (public.is_admin());

-- Templates
drop policy if exists templates_public_read on public.templates;
drop policy if exists templates_owner on public.templates;
drop policy if exists templates_admin_all on public.templates;
create policy templates_public_read on public.templates
  for select using (visibility in ('public', 'unlisted'));
create policy templates_owner on public.templates
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy templates_admin_all on public.templates
  for all using (public.is_admin()) with check (public.is_admin());

-- Template versions
drop policy if exists template_versions_public_read on public.template_versions;
drop policy if exists template_versions_owner on public.template_versions;
drop policy if exists template_versions_admin_all on public.template_versions;
create policy template_versions_public_read on public.template_versions
  for select
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_versions.template_id
        and t.visibility in ('public', 'unlisted')
    )
  );
create policy template_versions_owner on public.template_versions
  for all
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_versions.template_id
        and t.owner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.templates t
      where t.id = template_versions.template_id
        and t.owner_id = auth.uid()
    )
  );
create policy template_versions_admin_all on public.template_versions
  for all using (public.is_admin()) with check (public.is_admin());

-- Generation jobs
drop policy if exists generation_jobs_owner on public.generation_jobs;
drop policy if exists generation_jobs_admin_all on public.generation_jobs;
create policy generation_jobs_owner on public.generation_jobs
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy generation_jobs_admin_all on public.generation_jobs
  for all using (public.is_admin()) with check (public.is_admin());

-- Documents
drop policy if exists generated_documents_owner on public.generated_documents;
drop policy if exists generated_documents_admin_all on public.generated_documents;
create policy generated_documents_owner on public.generated_documents
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy generated_documents_admin_all on public.generated_documents
  for all using (public.is_admin()) with check (public.is_admin());

-- Usage ledger
drop policy if exists usage_ledger_owner on public.usage_ledger;
drop policy if exists usage_ledger_admin_all on public.usage_ledger;
create policy usage_ledger_owner on public.usage_ledger
  for select using (auth.uid() = user_id);
create policy usage_ledger_admin_all on public.usage_ledger
  for all using (public.is_admin()) with check (public.is_admin());

-- Subscriptions
drop policy if exists subscriptions_owner on public.subscriptions;
drop policy if exists subscriptions_admin_all on public.subscriptions;
create policy subscriptions_owner on public.subscriptions
  for select using (auth.uid() = user_id);
create policy subscriptions_admin_all on public.subscriptions
  for all using (public.is_admin()) with check (public.is_admin());

-- Payments
drop policy if exists payments_owner on public.payments;
drop policy if exists payments_admin_all on public.payments;
create policy payments_owner on public.payments
  for select using (auth.uid() = user_id);
create policy payments_admin_all on public.payments
  for all using (public.is_admin()) with check (public.is_admin());

-- Document outlines / versions (created in 004)
drop policy if exists document_outlines_owner on public.document_outlines;
drop policy if exists document_outlines_admin_all on public.document_outlines;
create policy document_outlines_owner on public.document_outlines
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy document_outlines_admin_all on public.document_outlines
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists document_versions_owner on public.document_versions;
drop policy if exists document_versions_admin_all on public.document_versions;
create policy document_versions_owner on public.document_versions
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy document_versions_admin_all on public.document_versions
  for all using (public.is_admin()) with check (public.is_admin());
