-- RAG schema wiring for public.documents and public.chunks.
--
-- HOW TO RUN: open this file, copy ITS CONTENTS, and paste them into the
-- Supabase SQL Editor (do not paste the file path). Run AFTER `prisma migrate`
-- has created the documents and chunks tables.
--
-- pgvector must be enabled first (Dashboard → Database → Extensions → "vector",
-- or the statement below) so the vector type/operators resolve.

create extension if not exists vector;

-- FKs to the Supabase-managed auth.users (Prisma can't model the auth schema).
alter table public.documents
  add constraint documents_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

alter table public.chunks
  add constraint chunks_user_id_fkey
  foreign key (user_id) references auth.users (id) on delete cascade;

-- Approximate-nearest-neighbour index for cosine similarity.
create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);

-- Row Level Security: a user sees/edits only their own rows.
alter table public.documents enable row level security;
alter table public.chunks enable row level security;

create policy "Users manage own documents"
  on public.documents
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage own chunks"
  on public.chunks
  for all
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Cosine-similarity search, RLS-enforced (security invoker) and explicitly
-- scoped to the current user. Call from the app via supabase.rpc("match_chunks").
create or replace function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  document_id uuid,
  content text,
  page int,
  similarity float
)
language sql
stable
as $$
  select
    c.id,
    c.document_id,
    c.content,
    c.page,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks as c
  where c.user_id = (select auth.uid())
    and c.embedding is not null
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
