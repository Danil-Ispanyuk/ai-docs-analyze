-- Billing / usage-metering wiring for public.usage (RM-3, plan limits).
--
-- HOW TO RUN: open this file, copy ITS CONTENTS, and paste them into the
-- Supabase SQL Editor (do not paste the file path). Run AFTER `prisma migrate`
-- has created the public.usage table (and added public.profiles.plan).
--
-- Prisma owns the table + columns; this file owns everything Prisma can't model:
-- the FK into the Supabase-managed auth schema, RLS, and the SECURITY DEFINER
-- functions that read/increment the counters.

-- FK to the Supabase-managed auth.users (Prisma can't model the auth schema).
-- Cascade so deleting a user (incl. guest cleanup, RM-4) removes their usage rows.
-- drop-then-add so re-running this whole file (e.g. to update the functions) is safe.
alter table public.usage
  drop constraint if exists usage_user_id_fkey;
alter table public.usage
  add constraint usage_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Row Level Security: a user can read only their own usage.
-- There is deliberately NO insert/update/delete policy: users must not be able
-- to reset or tamper with their own counters. All writes go through
-- increment_usage() below, which runs as SECURITY DEFINER and bypasses RLS.
alter table public.usage enable row level security;

drop policy if exists "Users read own usage" on public.usage;
create policy "Users read own usage"
  on public.usage
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Usage resets on a rolling 5-hour window (demo-friendly: a visitor can't exhaust
-- the token/request budget permanently). The period start is now() floored to the
-- nearest 5-hour boundary. get_usage() and increment_usage() both derive the current
-- period from this one function so they can never disagree on which bucket is live.
create or replace function public.usage_period_start()
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select to_timestamp(floor(extract(epoch from now()) / (5 * 3600)) * (5 * 3600));
$$;

-- Current-period usage for the calling user (0/0 when there is no row yet).
-- security invoker + explicit user filter, mirroring match_chunks. When the 5-hour
-- window rolls over there is no row for the new period, so this returns (0, 0).
create or replace function public.get_usage()
returns table (
  tokens_used int,
  requests_used int
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    coalesce(u.tokens_used, 0) as tokens_used,
    coalesce(u.requests_used, 0) as requests_used
  from (select 1) as _
  left join public.usage as u
    on u.user_id = (select auth.uid())
   and u.period_start = public.usage_period_start();
$$;

-- Add p_tokens tokens and one request to the caller's current-period counter,
-- creating the row on first use. SECURITY DEFINER so it bypasses RLS (the table
-- has no write policy); the row is always keyed to auth.uid(), so a caller can
-- only ever move their own counter forward. Keys the row to the current 5-hour
-- window, so a rollover opens a fresh row instead of touching the previous one.
create or replace function public.increment_usage(p_tokens int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.usage (user_id, period_start, tokens_used, requests_used)
  values ((select auth.uid()), public.usage_period_start(), greatest(p_tokens, 0), 1)
  on conflict (user_id, period_start) do update
    set tokens_used = public.usage.tokens_used + greatest(p_tokens, 0),
        requests_used = public.usage.requests_used + 1,
        updated_at = now();
end;
$$;

-- Lock down the mutator: only authenticated users may call it (for their own uid).
revoke all on function public.increment_usage(int) from public;
grant execute on function public.increment_usage(int) to authenticated;
