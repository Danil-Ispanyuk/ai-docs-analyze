# AI Document Analyzer

A RAG "chat with your documents" assistant. Upload your own PDFs and ask questions
in natural language — the app answers **only** from those documents and cites the
exact file and page for every answer. If the answer isn't in your documents, it says
so instead of guessing.

Vertical: **HR / onboarding assistant** (company policies, handbooks).

## How it works

Two pipelines over one vector store:

- **Ingestion** (once per document): upload → store the file in Supabase Storage →
  extract text → split into overlapping chunks → embed each chunk → save the chunk
  text, embedding, and metadata (file name, page) into `pgvector`.
- **Query** (per question): embed the question → cosine-similarity search in
  `pgvector` for the top-k chunks → build a prompt from those chunks → stream the
  answer with source citations. The model only ever sees the retrieved chunks, never
  whole documents.

Every document and chunk carries a `user_id` and is protected by row-level security,
so vector search never leaks another user's content.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui on Base UI primitives
- Vercel AI SDK v7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`)
- Supabase: Postgres + `pgvector` + Auth + Storage (RLS on all user data)
- Prisma 7 for schema and migrations only
- OpenAI `text-embedding-3-small` (embeddings) and `gpt-4o-mini` (answers)
- PDF: `unpdf` (server-side extraction), `react-pdf` (client preview)
- i18n via `next-intl`; Stripe for plan limits and billing

## Getting started

Requires [pnpm](https://pnpm.io) (npm/yarn are not supported).

```bash
pnpm install
cp .env.local.example .env.local   # then fill in the values below
pnpm dev                           # http://localhost:3000
```

### Environment

Set these in `.env.local` (see `.env.local.example`):

- `OPENAI_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only)
- `DATABASE_URL` (pooled, runtime), `DIRECT_URL` (migrations)
- Stripe keys for billing (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, …)

The Supabase-specific wiring that Prisma can't model (RLS policies, auth/storage
triggers, the `pgvector` index and `match_chunks` function) lives in `prisma/sql/*.sql`
and is applied by hand in the Supabase SQL Editor.

## Scripts

- `pnpm dev` / `pnpm build` / `pnpm start` — develop / build / serve
- `pnpm lint` — ESLint
- `pnpm format` / `pnpm format:check` — Prettier
- `pnpm prisma:generate` — regenerate the Prisma client
- `pnpm prisma:deploy` — apply migrations
