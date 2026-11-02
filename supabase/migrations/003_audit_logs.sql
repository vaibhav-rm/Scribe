-- ============================================================================
-- Scribe — Migration 003: Audit logging
-- ============================================================================

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}',
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_audit_logs_user_id on public.audit_logs(user_id);
create index idx_audit_logs_event_type on public.audit_logs(event_type);
create index idx_audit_logs_created_at on public.audit_logs(created_at);
create index idx_audit_logs_target on public.audit_logs(target_type, target_id);

-- RLS: users can read their own audit logs; admins read all
alter table public.audit_logs enable row level security;

create policy audit_logs_own on public.audit_logs
  for select using (auth.uid() = user_id);

create policy audit_logs_admin_all on public.audit_logs
  for all using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Updated at trigger not needed (insert-only)
