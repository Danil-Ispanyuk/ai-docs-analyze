-- Self-service account deletion — RM-6.
--
-- HOW TO RUN: paste THIS FILE'S CONTENTS into the Supabase SQL Editor (do not
-- paste the file path). No Prisma migration is involved: this is a function, not
-- schema. Run any time after the auth/rag/chat/billing/rateLimit setup files, so
-- every user table already FK-cascades from auth.users.
--
-- Scoped to the CALLER (auth.uid()): a signed-in user deletes their own account
-- and everything they own. Deleting the auth.users row FK-cascades to profiles/
-- documents/chunks/chat_messages/chat_rate_events/usage.
--
-- SECURITY DEFINER (owned by the privileged role) so it may touch the auth schema.
-- It never takes a user id as an argument — it always acts on auth.uid() — so a
-- caller can only ever delete their OWN account.
--
-- NOTE on storage bytes: Supabase does not allow direct deletes from
-- storage.objects. The app must remove files through the Storage API before
-- calling this function.

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

  -- Deleting the auth user cascades to profiles/documents/chunks/
  -- chat_messages/chat_rate_events/usage.
  delete from auth.users where id = v_user;
end;
$$;

-- Only authenticated users may call it (for their own uid via auth.uid()).
revoke all on function public.delete_current_user() from public;
grant execute on function public.delete_current_user() to authenticated;
