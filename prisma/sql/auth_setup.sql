-- Auth wiring for public.profiles.
--
-- Run this ONCE after `prisma migrate` has created the public.profiles table
-- (Supabase Dashboard > SQL Editor, or psql via DIRECT_URL). Prisma can't
-- generate these because they touch the Supabase-managed `auth` schema,
-- Row Level Security, and triggers.

-- 1) Tie profiles.id to the Supabase Auth user. Deleting the auth user
--    deletes the profile.
alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id) references auth.users (id) on delete cascade;

-- 2) Row Level Security: a user can only see/edit their own profile row.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by owner"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No INSERT policy on purpose: rows are created by the trigger below, which
-- runs as SECURITY DEFINER and bypasses RLS. No DELETE policy: the FK cascade
-- removes the profile when the auth user is deleted.

-- 3) Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();
