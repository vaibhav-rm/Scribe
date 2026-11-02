-- ============================================================================
-- Scribe — Migration 004: Resource text, outlines, document versions
-- ============================================================================

-- ---------------------------------------------------------------
-- Store the extracted text of a resource so generation can use it.
-- This column is private: it is never returned by the HTTP API and is
-- only read with the service-role key inside the generation pipeline.
-- ---------------------------------------------------------------
alter table public.project_resources
  add column if not exists extracted_text text;

create index if not exists idx_project_resources_status
  on public.project_resources(project_id, processing_status);

-- ---------------------------------------------------------------
-- Reviewed document outlines. A user can generate an outline, review it,
-- and then start generation from that exact outline.
-- ---------------------------------------------------------------
create table if not exists public.document_outlines (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_version_id uuid references public.template_versions(id) on delete set null,
  document_type text not null,
  outline_json jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_document_outlines_owner
  on public.document_outlines(owner_id);
create index if not exists idx_document_outlines_project
  on public.document_outlines(project_id);

alter table public.document_outlines enable row level security;

drop policy if exists document_outlines_owner on public.document_outlines;
create policy document_outlines_owner on public.document_outlines
  for all using (auth.uid() = owner_id);

drop policy if exists document_outlines_admin_all on public.document_outlines;
create policy document_outlines_admin_all on public.document_outlines
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------
-- Snapshot of a document before/after an edit so work is never silently
-- discarded. version_number matches generated_documents.version_number.
-- ---------------------------------------------------------------
create table if not exists public.document_versions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.generated_documents(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  version_number integer not null,
  content_json jsonb not null,
  source text not null default 'edit'
    check (source in ('generation', 'edit', 'regenerate', 'restore')),
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index if not exists idx_document_versions_document
  on public.document_versions(document_id, version_number desc);

alter table public.document_versions enable row level security;

drop policy if exists document_versions_owner on public.document_versions;
create policy document_versions_owner on public.document_versions
  for all using (auth.uid() = owner_id);

drop policy if exists document_versions_admin_all on public.document_versions;
create policy document_versions_admin_all on public.document_versions
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------
-- The outline actually used for a generation job (for audit / re-display).
-- ---------------------------------------------------------------
alter table public.generation_jobs
  add column if not exists outline_json jsonb;
