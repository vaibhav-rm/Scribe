-- ---------------------------------------------------------------
-- 010: Add missing generation_jobs.updated_at column
-- ---------------------------------------------------------------
-- Migration 001 creates an updated-at trigger on generation_jobs, and the
-- API writes updated_at on every job transition, but the column itself was
-- missing. That made progress, completion, failure, and cancellation updates
-- fail with PGRST204 ("Could not find the 'updated_at' column").
--
-- Safe to apply to existing projects.

alter table public.generation_jobs
  add column if not exists updated_at timestamptz not null default now();
