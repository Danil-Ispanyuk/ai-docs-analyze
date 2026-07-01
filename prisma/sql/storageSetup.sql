-- Storage bucket for uploaded files + per-user access policies.
--
-- HOW TO RUN: paste THIS FILE'S CONTENTS into the Supabase SQL Editor.
-- Files are stored under a "<user_id>/<filename>" path, so the first path
-- segment must match the current user.

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- storage.objects already has RLS enabled by Supabase; we just add policies.
create policy "Users read own files"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users upload own files"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users update own files"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users delete own files"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
