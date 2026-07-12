-- Rate limiting for POST /api/chat (TD-10): a per-user sliding window layered on top
-- of the cumulative plan caps in billingSetup.sql.
--
-- HOW TO RUN: open this file, copy ITS CONTENTS, and paste them into the Supabase SQL
-- Editor (do not paste the file path). Run AFTER `prisma migrate deploy` has created
-- the public.chat_rate_events table.
--
-- Prisma owns the table + columns; this file owns everything Prisma can't model: the
-- FK into the Supabase-managed auth schema, RLS, and the SECURITY DEFINER function
-- that both enforces the window and records the request.

-- FK to the Supabase-managed auth.users (Prisma can't model the auth schema).
-- Cascade so deleting a user (incl. guest cleanup, RM-4) removes their events.
alter table public.chat_rate_events
  add constraint chat_rate_events_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Row Level Security: a user can read only their own events. There is deliberately
-- NO insert/update/delete policy: all writes go through check_chat_rate() below,
-- which runs as SECURITY DEFINER and bypasses RLS, so a caller can't forge or clear
-- their own window.
alter table public.chat_rate_events enable row level security;

create policy "Users read own chat rate events"
  on public.chat_rate_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Atomically enforce the window and log the request for the calling user. Returns
-- true when the request is ALLOWED (and a row was inserted), false when the user
-- already has >= p_max events within the trailing p_window_seconds. Expired rows for
-- the caller are pruned on each call so the table stays small. SECURITY DEFINER so it
-- bypasses RLS (the table has no write policy); every row is keyed to auth.uid(), so
-- a caller can only ever affect their own window.
create or replace function public.check_chat_rate(p_max int, p_window_seconds int)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_count int;
begin
  if v_user is null then
    return false;
  end if;

  delete from public.chat_rate_events
  where user_id = v_user
    and created_at < now() - make_interval(secs => p_window_seconds);

  select count(*) into v_count
  from public.chat_rate_events
  where user_id = v_user;

  if v_count >= p_max then
    return false;
  end if;

  insert into public.chat_rate_events (user_id) values (v_user);
  return true;
end;
$$;

-- Lock down the mutator: only authenticated users may call it (for their own uid).
revoke all on function public.check_chat_rate(int, int) from public;
grant execute on function public.check_chat_rate(int, int) to authenticated;
