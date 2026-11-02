-- ============================================================================
-- Scribe — Initial Database Migration
-- ============================================================================
-- Creates all core tables, indexes, RLS policies, triggers, and helper
-- functions. Run against a fresh Supabase project, then apply 002-006.

-- Enable extensions
create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------
create table public.profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  avatar_url text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- colleges
-- ---------------------------------------------------------------
create table public.colleges (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name citext not null unique,
  location text,
  website text,
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'verified')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------
-- departments
-- ---------------------------------------------------------------
create table public.departments (
  id uuid primary key default gen_random_uuid(),
  college_id uuid not null references public.colleges(id) on delete cascade,
  name text not null,
  normalized_name citext not null,
  unique (college_id, normalized_name)
);

-- ---------------------------------------------------------------
-- projects
-- ---------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  department_id uuid references public.departments(id) on delete set null,
  academic_year text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index idx_projects_owner_id on public.projects(owner_id);
create index idx_projects_deleted_at on public.projects(deleted_at);

-- ---------------------------------------------------------------
-- project_resources
-- ---------------------------------------------------------------
create table public.project_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  resource_type text not null check (resource_type in ('text', 'file', 'github')),
  original_filename text,
  storage_path text,
  external_url text,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'completed', 'failed')),
  extracted_text_ref text,   -- reference to private storage, not the raw text
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_project_resources_project_id on public.project_resources(project_id);
create index idx_project_resources_owner_id on public.project_resources(owner_id);

-- ---------------------------------------------------------------
-- templates
-- ---------------------------------------------------------------
create table public.templates (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null, -- null for system templates
  college_id uuid references public.colleges(id) on delete set null,
  department_id uuid references public.departments(id) on delete set null,
  title text not null,
  description text,
  document_type text not null,
  academic_year text,
  visibility text not null default 'private' check (visibility in ('private', 'unlisted', 'public')),
  verification_status text not null default 'unverified' check (verification_status in ('unverified', 'pending', 'verified', 'rejected')),
  current_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_templates_owner_id on public.templates(owner_id);
create index idx_templates_document_type on public.templates(document_type);
create index idx_templates_visibility on public.templates(visibility);

-- ---------------------------------------------------------------
-- template_versions
-- ---------------------------------------------------------------
create table public.template_versions (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.templates(id) on delete cascade,
  version_number integer not null,
  storage_path text not null,
  parsed_specification jsonb,
  parsing_status text not null default 'pending' check (parsing_status in ('pending', 'completed', 'failed')),
  validation_warnings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, version_number)
);

create index idx_template_versions_template_id on public.template_versions(template_id);

-- The templates.current_version_id column points at a template_versions row,
-- but template_versions is created after templates. Add the FK now that both
-- tables exist (an inline forward reference would make this migration fail).
alter table public.templates
  add constraint templates_current_version_id_fkey
  foreign key (current_version_id) references public.template_versions(id)
  on delete set null;

-- ---------------------------------------------------------------
-- generation_jobs
-- ---------------------------------------------------------------
create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  template_version_id uuid references public.template_versions(id) on delete set null,
  document_type text not null,
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  progress integer not null default 0 check (progress >= 0 and progress <= 100),
  error_code text,
  error_message text,
  provider text not null,
  model text not null,
  estimated_cost numeric,
  actual_cost numeric,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index idx_generation_jobs_owner_id on public.generation_jobs(owner_id);
create index idx_generation_jobs_project_id on public.generation_jobs(project_id);
create index idx_generation_jobs_status on public.generation_jobs(status);

-- ---------------------------------------------------------------
-- generated_documents
-- ---------------------------------------------------------------
create table public.generated_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  generation_job_id uuid not null references public.generation_jobs(id) on delete cascade,
  title text not null,
  version_number integer not null default 1,
  content_json jsonb,
  docx_storage_path text,
  pdf_storage_path text,
  status text not null default 'draft' check (status in ('draft', 'completed', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_generated_documents_owner_id on public.generated_documents(owner_id);
create index idx_generated_documents_project_id on public.generated_documents(project_id);

-- ---------------------------------------------------------------
-- usage_ledger
-- ---------------------------------------------------------------
create table public.usage_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  credits_delta integer not null,
  idempotency_key text not null,
  generation_job_id uuid references public.generation_jobs(id) on delete set null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Prevent duplicate usage-ledger events (idempotency)
create unique index idx_usage_ledger_idempotency on public.usage_ledger(idempotency_key);
create index idx_usage_ledger_user_id on public.usage_ledger(user_id);
create index idx_usage_ledger_created_at on public.usage_ledger(created_at);

-- ---------------------------------------------------------------
-- subscriptions
-- ---------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_customer_id text,
  provider_subscription_id text,
  plan_code text not null check (plan_code in ('free', 'pro')),
  status text not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index idx_subscriptions_user_id on public.subscriptions(user_id);

-- ---------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null,
  provider_order_id text not null,
  provider_payment_id text,
  amount_minor_units integer not null check (amount_minor_units >= 0),
  currency text not null default 'INR',
  status text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now()
);

create unique index idx_payments_idempotency on public.payments(idempotency_key);
create index idx_payments_user_id on public.payments(user_id);

-- ---------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles for each row
  execute procedure public.set_updated_at();

create trigger trg_projects_updated_at
  before update on public.projects for each row
  execute procedure public.set_updated_at();

create trigger trg_templates_updated_at
  before update on public.templates for each row
  execute procedure public.set_updated_at();

create trigger trg_template_versions_updated_at
  before update on public.template_versions for each row
  execute procedure public.set_updated_at();

create trigger trg_generation_jobs_updated_at
  before update on public.generation_jobs for each row
  execute procedure public.set_updated_at();

create trigger trg_generated_documents_updated_at
  before update on public.generated_documents for each row
  execute procedure public.set_updated_at();

create trigger trg_subscriptions_updated_at
  before update on public.subscriptions for each row
  execute procedure public.set_updated_at();

-- ---------------------------------------------------------------
-- Row Level Security (RLS)
-- ---------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.colleges enable row level security;
alter table public.departments enable row level security;
alter table public.projects enable row level security;
alter table public.project_resources enable row level security;
alter table public.templates enable row level security;
alter table public.template_versions enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.generated_documents enable row level security;
alter table public.usage_ledger enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;

-- Admin checks must avoid recursive RLS evaluation. A SECURITY DEFINER
-- function owned by the migration role reads profiles without re-triggering
-- the profiles policies.
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

-- Profiles: users read/write own; admins read all
create policy profiles_own on public.profiles
  for all using (auth.uid() = id);
create policy profiles_admin_all on public.profiles
  for all using (
    public.is_admin()
  );

-- Colleges: readable by all authenticated; writes by admins
create policy colleges_read_all on public.colleges for select using (auth.role() = 'authenticated');
create policy colleges_admin_write on public.colleges for all using (
  public.is_admin()
);

-- Departments: readable by all authenticated; writes by admins
create policy departments_read_all on public.departments for select using (auth.role() = 'authenticated');
create policy departments_admin_write on public.departments for all using (
  public.is_admin()
);

-- Projects: owner CRUD; admins all
create policy projects_owner on public.projects
  for all using (auth.uid() = owner_id);
create policy projects_admin_all on public.projects
  for all using (
    public.is_admin()
  );

-- Project resources: owner CRUD on own project's resources
create policy project_resources_owner on public.project_resources
  for all using (auth.uid() = owner_id);
create policy project_resources_admin_all on public.project_resources
  for all using (
    public.is_admin()
  );

-- Templates:
--  - public/unlisted metadata readable by all authenticated
--  - owner CRUD own templates
--  - admins all
create policy templates_public_read on public.templates
  for select using (visibility in ('public', 'unlisted'));
create policy templates_owner on public.templates
  for all using (auth.uid() = owner_id);
create policy templates_admin_all on public.templates
  for all using (
    public.is_admin()
  );

-- Template versions: same visibility rules as parent template
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
  );
create policy template_versions_admin_all on public.template_versions
  for all using (
    public.is_admin()
  );

-- Generation jobs: owner read; admins all
create policy generation_jobs_owner on public.generation_jobs
  for all using (auth.uid() = owner_id);
create policy generation_jobs_admin_all on public.generation_jobs
  for all using (
    public.is_admin()
  );

-- Generated documents: owner read; admins all
create policy generated_documents_owner on public.generated_documents
  for all using (auth.uid() = owner_id);
create policy generated_documents_admin_all on public.generated_documents
  for all using (
    public.is_admin()
  );

-- Usage ledger: owner read; admins all
create policy usage_ledger_owner on public.usage_ledger
  for select using (auth.uid() = user_id);
create policy usage_ledger_admin_all on public.usage_ledger
  for all using (
    public.is_admin()
  );

-- Subscriptions: owner read; admins all
create policy subscriptions_owner on public.subscriptions
  for select using (auth.uid() = user_id);
create policy subscriptions_admin_all on public.subscriptions
  for all using (
    public.is_admin()
  );

-- Payments: owner read; admins all
create policy payments_owner on public.payments
  for select using (auth.uid() = user_id);
create policy payments_admin_all on public.payments
  for all using (
    public.is_admin()
  );

-- ---------------------------------------------------------------
-- Credit management: server-only function
-- Adjusts a user's credit balance idempotently and records a ledger entry.
-- Clients can never call this directly to inflate their balance.
-- ---------------------------------------------------------------
create or replace function public.adjust_credits(
  p_user_id uuid,
  p_event_type text,
  p_credits_delta integer,
  p_idempotency_key text,
  p_generation_job_id uuid default null,
  p_metadata jsonb default '{}'
) returns integer
language plpgsql
as $$
declare
  v_balance integer;
begin
  -- Idempotency: if this ledger key already exists, return current delta impact
  if exists (
    select 1 from public.usage_ledger where idempotency_key = p_idempotency_key
  ) then
    select credits_delta into v_balance
    from public.usage_ledger
    where idempotency_key = p_idempotency_key;
    return v_balance;
  end if;

  insert into public.usage_ledger (
    user_id, event_type, credits_delta, idempotency_key,
    generation_job_id, metadata
  ) values (
    p_user_id, p_event_type, p_credits_delta, p_idempotency_key,
    p_generation_job_id, p_metadata
  )
  returning credits_delta into v_balance;

  return v_balance;
end;
$$;

-- Only service-role / admins should invoke credit adjustments in practice.
-- RLS on usage_ledger restricts inserts to the user's own rows, so this
-- function (run as service role) bypasses RLS and is the single write path.
revoke all on function public.adjust_credits(uuid, text, integer, text, uuid, jsonb) from public;

-- ---------------------------------------------------------------
-- Seed: default colleges / departments (optional sample data)
-- ---------------------------------------------------------------
insert into public.colleges (name, normalized_name, location, verification_status)
values
  ('Vellore Institute of Technology', 'vellore-institute-of-technology', 'Vellore, Tamil Nadu', 'verified')
on conflict (normalized_name) do nothing;

insert into public.departments (college_id, name, normalized_name)
select c.id, 'Computer Science and Engineering', 'computer-science-engineering'
from public.colleges c where c.normalized_name = 'vellore-institute-of-technology'
on conflict (college_id, normalized_name) do nothing;

insert into public.departments (college_id, name, normalized_name)
select c.id, 'Electronics and Communication Engineering', 'electronics-communication-engineering'
from public.colleges c where c.normalized_name = 'vellore-institute-of-technology'
on conflict (college_id, normalized_name) do nothing;

-- ---------------------------------------------------------------
-- Storage buckets (private by default)
-- ---------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('project-resources', 'project-resources', false, 15728640, ARRAY[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ]),
  ('templates', 'templates', false, 52428800, ARRAY[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf'
  ]),
  ('generated-documents', 'generated-documents', false, 104857600, ARRAY[
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf'
  ])
on conflict (id) do nothing;

-- Storage RLS: users can only read/write their own objects, scoped by bucket
create policy storage_project_resources_owner on storage.objects
  for all using (
    bucket_id = 'project-resources' and owner_id = auth.uid()::text
  );
create policy storage_templates_owner on storage.objects
  for all using (
    bucket_id = 'templates' and owner_id = auth.uid()::text
  );
create policy storage_generated_documents_owner on storage.objects
  for all using (
    bucket_id = 'generated-documents' and owner_id = auth.uid()::text
  );
