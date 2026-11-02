-- ============================================================================
-- Scribe — Migration 002: Job queue RPC functions
-- ============================================================================

-- Atomically claim the next queued generation job for processing.
-- Uses SELECT ... FOR UPDATE SKIP LOCKED to avoid race conditions between
-- multiple worker processes. Returns the claimed job row, or NULL if none.
create or replace function public.claim_next_job(p_consumer_id text)
returns setof public.generation_jobs
language plpgsql
as $$
begin
  return query
  update public.generation_jobs
  set status = 'processing',
      started_at = now(),
      updated_at = now()
  where id in (
    select id from public.generation_jobs
    where status = 'queued'
    order by created_at asc
    for update skip locked
    limit 1
  )
  returning *;
end;
$$;

-- Revoke public execute; only the service role should invoke this.
revoke all on function public.claim_next_job(text) from public;
