-- Chat history wiring for public.chat_messages (persisted conversations).
--
-- HOW TO RUN: open this file, copy ITS CONTENTS, and paste them into the
-- Supabase SQL Editor (do not paste the file path). Run AFTER the
-- 20260713120000_chat_messages migration has created the table.
--
-- Prisma owns the table + columns + the FK to public.documents; this file owns
-- what Prisma can't model: the FK into the Supabase-managed auth schema and RLS.

-- FK to the Supabase-managed auth.users (Prisma can't model the auth schema).
-- Cascade so deleting a user (incl. guest cleanup, RM-4) removes their messages.
alter table public.chat_messages
  add constraint chat_messages_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Row Level Security: a user can only ever see and write their own messages.
alter table public.chat_messages enable row level security;

create policy "Users read own chat messages"
  on public.chat_messages
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users insert own chat messages"
  on public.chat_messages
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users delete own chat messages"
  on public.chat_messages
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);
