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

-- Cosine-similarity search over the caller's chunks, RLS-enforced (security invoker)
-- and additionally scoped to auth.uid(). Returns the source document `name` for
-- citations and supports a similarity floor + an optional document filter.
--
-- Call from the app via supabase.rpc("match_chunks", { query_embedding, match_count,
-- match_threshold, document_ids }); keep these argument names and the returned columns
-- in sync with the call site in src/app/api/chat/route.ts (see CLAUDE.md "Data access").
--
-- Drop older signatures first so a rebuild REPLACES the function instead of leaving a
-- stale overload behind (the earlier 2-arg version returned no `name` column).
drop function if exists public.match_chunks(vector, int);
drop function if exists public.match_chunks(vector, int, float, uuid[]);

create function public.match_chunks(
  query_embedding vector(1536),
  match_count int default 6,
  match_threshold float default 0.2,
  document_ids uuid[] default null
)
returns table (
  id uuid,
  document_id uuid,
  name text,
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
    d.name,
    c.content,
    c.page,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks as c
  join public.documents as d on d.id = c.document_id
  where c.user_id = (select auth.uid())
    and c.embedding is not null
    and (document_ids is null or c.document_id = any(document_ids))
    and (1 - (c.embedding <=> query_embedding)) >= match_threshold
  order by c.embedding <=> query_embedding
  limit match_count;
$$;
