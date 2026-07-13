-- Folder wiring for public.folders — RM-7 (group documents + scope chat by folder).
--
-- HOW TO RUN: open this file, copy ITS CONTENTS, and paste them into the Supabase
-- SQL Editor (do not paste the file path). Run AFTER `prisma migrate deploy` has
-- created the public.folders table (and added documents.folder_id / chat_messages.folder_id).
--
-- Prisma owns the table + columns + the public→public FKs (documents.folder_id and
-- chat_messages.folder_id); this file owns what Prisma can't model: the FK into the
-- Supabase-managed auth schema and RLS.

-- FK to the Supabase-managed auth.users (Prisma can't model the auth schema).
-- Cascade so deleting a user (guest cleanup RM-4, account deletion RM-6) removes
-- their folders. The user delete also cascades their documents/chat_messages, so
-- the documents.folder_id SET NULL rule never has to fire during a user delete.
alter table public.folders
  add constraint folders_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Row Level Security: a user sees/edits only their own folders.
alter table public.folders enable row level security;

create policy "Users manage own folders"
  on public.folders
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
