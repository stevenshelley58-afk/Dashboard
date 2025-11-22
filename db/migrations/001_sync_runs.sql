-- Basic sync_runs table to support the worker job dispatcher and manual sync API.
-- This will likely be extended in later schema tasks.

create extension if not exists "pgcrypto";

create table if not exists sync_runs (
  sync_run_id uuid primary key default gen_random_uuid(),
  integration_id uuid not null,
  job_type text not null,
  status text not null default 'queued',
  "trigger" text,
  retry_count integer not null default 0,
  rate_limited boolean,
  rate_limit_reset_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  error_code text,
  error_message text,
  stats jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_sync_runs_status_created_at
  on sync_runs (status, created_at desc);

create index if not exists idx_sync_runs_integration_id
  on sync_runs (integration_id);


