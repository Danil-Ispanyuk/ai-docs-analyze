---
name: db-migrate
description: Change the database schema (documents, chunks, profiles, or new tables). Use whenever a task adds/renames columns, adds tables, or touches RLS, triggers, pgvector, or Supabase storage policies.
---

# Database schema changes

The schema is split between two owners — a change is not done until both sides are consistent:

1. **`prisma/schema.prisma`** — tables, columns, indexes. Applied via Prisma Migrate.
2. **`prisma/sql/*.sql`** — everything Prisma can't model: FKs into the Supabase-managed `auth` schema, RLS policies, triggers (`handle_new_user`), the `vector(1536)` type/HNSW index, the `match_chunks` function, and storage bucket policies. These are pasted into the Supabase SQL Editor **by hand** (`auth_setup.sql`, `ragSetup.sql`, `storageSetup.sql`).

## Workflow

1. Edit `prisma/schema.prisma`. Follow the existing style: `@map`/`@@map` to snake_case, `@db.Uuid`, `@db.Timestamptz(6)`, uuid PKs via `gen_random_uuid()`.
2. If the change involves RLS, auth FKs, triggers, vectors, or storage — update the matching `prisma/sql/*.sql` file too, and tell the owner it must be re-run in the Supabase SQL Editor.
3. Show the owner the commands to run — **do not run migrations yourself** (they hit a real Supabase database):
   ```bash
   pnpm prisma:migrate   # dev migration, uses DIRECT_URL (port 5432)
   pnpm prisma:generate  # regenerate client into src/generated/prisma
   ```
4. Never edit anything in `src/generated/prisma/` or in `prisma/migrations/` by hand.

## Invariants

- Every user-owned table carries `user_id uuid` with an RLS policy on `auth.uid()` — new user data tables must get both a FK in the SQL file and a policy.
- `chunks.user_id` is denormalized from `documents` on purpose, so `match_chunks` can filter by user under RLS. Keep it.
- Embedding dimension is 1536 (`text-embedding-3-small`). Changing the embedding model means changing `vector(1536)`, the HNSW index, and re-ingesting everything — flag this, don't do it silently.
- If `match_chunks` gains/loses parameters or returned columns, update **both** `prisma/sql/ragSetup.sql` and the `supabase.rpc("match_chunks", ...)` call + `Matched` type in `src/app/api/chat/route.ts`.
- Prisma connects as a privileged role and bypasses RLS — runtime per-user reads/writes go through the Supabase client, never `src/lib/prisma.ts`.
