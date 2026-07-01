# CLAUDE.md

Project context and working rules for Claude Code. Loaded at the start of every session.

## Project

RAG "chat with your documents" assistant. Users upload their own files (PDF for now) and ask questions in natural language. The app answers **only** from those documents and shows a source citation (file + page) for every answer; if the answer isn't in the documents, it says so instead of guessing. Built as a portfolio / demo piece (target: Upwork freelancing).

Vertical: **HR / onboarding assistant** (company policies). Demo content and theming follow from this — change this line if the vertical changes.

## How to work with me (read this first)

I am the developer. I build this project myself. You are an on-demand assistant, not the driver.

- **Do only what I explicitly ask.** Implement the exact piece requested — one component, one route, one function — then stop. Never scaffold the whole app, add "nice to have" features, or build the next step on your own.
- **Stay in scope.** Don't refactor, rename, reformat, or touch files unrelated to my request. If you think something else needs changing, say so in one line and let me decide — don't do it.
- **When I ask you to "add" or "generate" something, do write the file(s) for that thing** — that's the point. Just keep it limited to exactly what I asked.
- **Plan before non-trivial work.** If a request touches more than ~1 file or involves an architectural choice, give me a 2–4 line plan and wait for my go-ahead. Tiny obvious edits don't need this.
- **No new dependencies without asking.** Use the stack below. If something genuinely needs a new package, propose it first with a reason.
- **Don't run destructive or stateful commands on your own** — no `git commit` / `push`, no deleting files, no `npm install` of new packages, no migrations against a real database. Show me the command instead.
- **Keep changes small and reviewable.** After a change, give a 1–2 sentence summary of what you added and why. Match the existing code style.
- **Ask, don't guess.** On ambiguity, ask one clarifying question rather than building the largest interpretation.

## Stack (don't swap without asking)

- Next.js (App Router) + TypeScript
- Tailwind CSS + shadcn/ui using the **Base UI** primitives (`npx shadcn create`, Base UI variant)
- Vercel AI SDK for model calls and streaming (`useChat` on the client)
- Supabase: Postgres + `pgvector` (vectors) + Auth + Storage — one platform for DB, files, and login
- Auth: Supabase Auth via `@supabase/ssr` (App Router session handling) + Postgres Row Level Security
- Models: `text-embedding-3-small` for embeddings; `gpt-4o-mini` or Claude Haiku for answers
- PDF text extraction: `pdf-parse` or `unpdf`. Chunking is hand-written (simple splitter with overlap) — do not add LangChain / LlamaIndex.
- No separate backend: use Next.js route handlers / server actions.

## Architecture — RAG, two pipelines over one vector store

Ingestion (once per document): upload → store file in Supabase Storage → extract text → split into overlapping chunks → embed each chunk → save chunk text + embedding + metadata (file name, page) into `pgvector`.

Query (per question): embed the question → cosine similarity search in `pgvector` for top-k chunks → build a prompt with those chunks as context → stream the LLM answer with source citations. The model never receives whole documents, only the retrieved chunks.

## Security (hard requirement)

Every document/chunk row carries a `user_id`, and RLS restricts rows to `auth.uid()`. **The vector similarity search must filter by `user_id` (or run under RLS).** A search that ignores `user_id` leaks other users' chunks — treat this as non-negotiable, not an optimization.

## Scope

In MVP: auth, PDF upload + ingestion, chat with streaming, source citations, "I don't know" fallback, multiple documents.

Out for now (don't build unless I ask): file formats beyond PDF, conversation memory beyond the current thread, teams / roles / sharing, analytics dashboards. If a request would pull these in, flag it before proceeding.

## Conventions

- TypeScript throughout; prefer server components and route handlers.
- Secrets in env vars: `OPENAI_API_KEY` / `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Keep model/provider calls behind a thin wrapper module so the LLM is easy to swap.
