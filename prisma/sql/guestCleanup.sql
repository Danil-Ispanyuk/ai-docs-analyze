-- Auto-expiry of guest (anonymous) users — RM-4 Phase C.
--
-- HOW TO RUN: paste THIS FILE'S CONTENTS into the Supabase SQL Editor. Requires
-- the pg_cron extension (Dashboard > Database > Extensions > enable "pg_cron").
--
-- Guests sign in anonymously (is_anonymous = true) and never come back. This job
-- deletes their accounts once they're older than the TTL; the auth.users delete
-- FK-cascades to profiles/documents/chunks.
--
-- NOTE on storage bytes: Supabase does not allow direct deletes from
-- storage.objects. Delete guest files via the Storage API from a scheduled Edge
-- Function before or after this SQL cleanup.

create extension if not exists pg_cron;

-- Deletes anonymous users older than the TTL.
-- SECURITY DEFINER (owned by the privileged postgres role) so it may touch the
-- auth schema; scheduled below via pg_cron.
create or replace function public.cleanup_anonymous_users()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  stale_ttl constant interval := interval '24 hours';
begin
  -- Deleting the auth user cascades to profiles/documents/chunks.
  delete from auth.users
  where is_anonymous
    and created_at < now() - stale_ttl;
end;
$$;

-- Run hourly. Re-running this schedule call is safe: unschedule any prior job of
-- the same name first so the definition stays single.
select cron.unschedule('cleanup-anonymous-users')
where exists (select 1 from cron.job where jobname = 'cleanup-anonymous-users');

select cron.schedule(
  'cleanup-anonymous-users',
  '0 * * * *',
  $$select public.cleanup_anonymous_users()$$
);
