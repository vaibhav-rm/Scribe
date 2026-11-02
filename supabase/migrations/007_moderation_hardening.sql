-- ---------------------------------------------------------------
-- 007: Moderation and privilege-escalation hardening
-- ---------------------------------------------------------------
-- Apply after 006. This migration closes two gaps that RLS alone cannot
-- express:
--   1. An owner could update their own profile.role to "admin" through the
--      Supabase anon client.
--   2. An owner could mark their own template as verified, or alter published
--      public content without re-entering moderation.
-- It also restricts direct reads of public templates to genuinely published
-- (verified) rows. The API itself uses the service role and is unaffected.

-- ---------------------------------------------------------------
-- Profile role protection
-- ---------------------------------------------------------------
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role and SQL-console changes have no auth.uid() and are trusted.
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.role is distinct from 'user' and not public.is_admin() then
      new.role := 'user';
    end if;
    return new;
  end if;

  if new.id is distinct from old.id then
    raise exception 'The profile id cannot be changed';
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only administrators can change profile roles';
  end if;

  return new;
end;
$$;

drop trigger if exists protect_profile_role_trigger on public.profiles;
create trigger protect_profile_role_trigger
  before insert or update on public.profiles
  for each row execute function public.protect_profile_role();

-- ---------------------------------------------------------------
-- Template moderation protection
-- ---------------------------------------------------------------
create or replace function public.protect_template_moderation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service-role and SQL-console changes are trusted (the API uses those).
  if auth.uid() is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is distinct from auth.uid() then
      new.owner_id := auth.uid();
    end if;
    if new.visibility = 'public' then
      new.verification_status := 'pending';
    elsif not public.is_admin() then
      new.verification_status := 'unverified';
    end if;
    new.review_notes := null;
    return new;
  end if;

  if not public.is_admin() then
    -- Ownership and review state are server-managed.
    new.owner_id := old.owner_id;
    if new.verification_status is distinct from old.verification_status then
      new.verification_status := old.verification_status;
    end if;
    if new.review_notes is distinct from old.review_notes then
      new.review_notes := old.review_notes;
    end if;

    -- Any change to published content re-enters moderation.
    if new.visibility = 'public' and (
      new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.document_type is distinct from old.document_type
      or new.academic_year is distinct from old.academic_year
      or new.visibility is distinct from old.visibility
      or new.current_version_id is distinct from old.current_version_id
    ) then
      new.verification_status := 'pending';
      new.review_notes := null;
    end if;

    if new.visibility is distinct from 'public'
      and old.verification_status = 'pending' then
      new.verification_status := 'unverified';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists protect_template_moderation_trigger on public.templates;
create trigger protect_template_moderation_trigger
  before insert or update on public.templates
  for each row execute function public.protect_template_moderation();

-- ---------------------------------------------------------------
-- Direct reads: only verified public templates are published.
-- Owners still read their own rows through templates_owner.
-- ---------------------------------------------------------------
drop policy if exists templates_public_read on public.templates;
create policy templates_public_read on public.templates
  for select
  using (visibility = 'public' and verification_status = 'verified');

drop policy if exists template_versions_public_read on public.template_versions;
create policy template_versions_public_read on public.template_versions
  for select
  using (
    exists (
      select 1 from public.templates t
      where t.id = template_versions.template_id
        and t.visibility = 'public'
        and t.verification_status = 'verified'
    )
  );
