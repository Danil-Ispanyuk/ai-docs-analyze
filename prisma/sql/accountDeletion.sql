-- Self-service account deletion — RM-6.
--
-- HOW TO RUN: paste THIS FILE'S CONTENTS into the Supabase SQL Editor (do not
-- paste the file path). No Prisma migration is involved: this is a function, not
-- schema. Run any time after the auth/rag/chat/billing/rateLimit setup files, so
-- every user table already FK-cascades from auth.users.
--
-- Mirrors guestCleanup.sql, but scoped to the CALLER (auth.uid()) instead of a TTL:
-- a signed-in user deletes their own account and everything they own. Deleting the
-- auth.users row FK-cascades to profiles/documents/chunks/chat_messages/
-- chat_rate_events/usage; storage.objects has no FK from auth.users, so we clear the
-- caller's files first.
--
-- SECURITY DEFINER (owned by the privileged role) so it may touch the auth and
-- storage schemas. It never takes a user id as an argument — it always acts on
-- auth.uid() — so a caller can only ever delete their OWN account.
--
-- NOTE on storage bytes: deleting storage.objects rows removes the file metadata
-- (so the app stays consistent), but the underlying object bytes may linger in the
-- storage backend — the same known trade-off as guestCleanup.sql / TD-11. For
-- byte-perfect cleanup, delete via the Storage API before calling this.

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;

  -- Storage metadata first (no FK cascade from auth.users to storage.objects).
  delete from storage.objects
  where bucket_id = 'documents'
    and (storage.foldername(name))[1] = v_user::text;

  -- Deleting the auth user cascades to profiles/documents/chunks/chat_messages/
  -- chat_rate_events/usage.
  delete from auth.users where id = v_user;
end;
$$;

-- Only authenticated users may call it (for their own uid via auth.uid()).
revoke all on function public.delete_current_user() from public;
grant execute on function public.delete_current_user() to authenticated;
