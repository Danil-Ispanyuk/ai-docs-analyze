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
- **Every new feature gets a doc.** When you finish a feature from `docs/ROADMAP.md`, add (or update) its implementation doc under `docs/features/` — one file per feature (`<id>-<slug>.md`), written **after** the work so it describes the shipped code, and add it to the `docs/features/README.md` index. Follow the format in `docs/features/README.md`.
- **Ask, don't guess.** On ambiguity, ask one clarifying question rather than building the largest interpretation.

## Commands

pnpm only — never npm or yarn.

- `pnpm dev` — dev server at http://localhost:3000
- `pnpm build` / `pnpm start` — production build / serve
- `pnpm lint` — ESLint
- `pnpm format` / `pnpm format:check` — Prettier (tabs, printWidth 100, double quotes; Tailwind class sorting incl. inside `cn(...)`)
- `pnpm prisma:migrate` — create/apply a dev migration (uses `DIRECT_URL`; show me the command instead of running it against a real DB)
- `pnpm prisma:generate` — regenerate the client into `src/generated/prisma`
- `pnpm prisma:deploy` — apply migrations in prod

Tests run on **Vitest**: `pnpm test` (run once), `pnpm test:watch`; specs are colocated in each feature's `test/` folder. `pnpm typecheck` runs `tsc --noEmit`. Husky pre-commit runs `lint-staged` (Prettier on staged files).

## Stack (don't swap without asking)

- Next.js 16 (App Router) + TypeScript; path alias `@/*` → `src/*`
- Tailwind CSS v4 + shadcn/ui on **Base UI** primitives, generated into `src/shared/ui/`
- Vercel AI SDK v7 (`ai`, `@ai-sdk/openai`, `@ai-sdk/react`): `useChat` on the client, `streamText` + `createUIMessageStream` on the server
- Supabase: Postgres + `pgvector` + Auth (`@supabase/ssr`) + Storage; RLS on all user data
- Prisma 7: **schema + migrations only** (see Data access below)
- Models: `text-embedding-3-small` (1536 dims) for embeddings; `gpt-4o-mini` for answers
- PDF: `unpdf` for server-side text extraction; `react-pdf` for the client preview. Chunking is hand-written (`src/features/documents/lib/chunk.ts`) — do not add LangChain / LlamaIndex.
- i18n: `next-intl` with a cookie-based locale (no URL routing)
- Forms: `react-hook-form` + `zod` (schemas colocated per feature in `src/features/<domain>/validators.ts`); HugeIcons re-exported from `src/shared/assets/icons`
- No separate backend: use Next.js route handlers / server actions.

## Architecture — RAG, two pipelines over one vector store

Ingestion (once per document): upload → store file in Supabase Storage → extract text → split into overlapping chunks → embed each chunk → save chunk text + embedding + metadata (file name, page) into `pgvector`.

Query (per question): embed the question → cosine similarity search in `pgvector` for top-k chunks → build a prompt with those chunks as context → stream the LLM answer with source citations. The model never receives whole documents, only the retrieved chunks.

In code: ingestion lives in `src/features/documents/actions.ts` (`src/features/documents/lib/pdf.ts` → `lib/chunk.ts` → `lib/embedding.ts` → insert into `chunks`); the query pipeline is `src/app/api/chat/route.ts` (embed question → `supabase.rpc("match_chunks")` → stream answer, sources sent as a `data-sources` UI-message part).

## Data access — two clients, different rules

- **Supabase client** (`src/shared/config/supabase/server.ts` / `client.ts`; `admin.ts` is the service-role client, `middleware.ts` refreshes the session) — all user-facing reads/writes. Runs under RLS as the signed-in user.
- **Prisma** — schema and migrations only (no runtime client is instantiated in `src/`). It connects as a privileged role and **bypasses RLS — never use it for per-user reads/writes.**
- Prisma can't model the Supabase `auth` schema, RLS policies, triggers, storage policies, or the `vector` index/function. Those live in `prisma/sql/*.sql` (`auth_setup.sql`, `ragSetup.sql`, `storageSetup.sql`, `billingSetup.sql`, `guestCleanup.sql`) and are pasted into the Supabase SQL Editor by hand. When a migration touches `documents`/`chunks`/auth/storage wiring, check whether a `prisma/sql` script must change too — and keep `match_chunks` args in `route.ts` in sync with its SQL definition.

## Structure

Feature-based. Each domain lives under `src/features/<domain>/` and owns its own slices; shared/cross-cutting code lives under `src/shared/`. Barrel `index.ts` files per folder. Routes in `src/app/` stay thin and compose feature components.

- `src/app/` — App Router routes (kept thin): `(auth)` pages, `api/chat` + `api/stripe/webhook` route handlers, `auth/*` callbacks, `profile`, root `page.tsx`/`layout.tsx`
- `src/features/<domain>/` — one folder per domain: `auth`, `billing`, `chat`, `documents`, `folders`, `landing`, `profile`, `workspace`. Inside a feature: `actions.ts` (`"use server"` actions), `service.ts` (data access), `validators.ts` (zod schemas), `components/` (feature UI, with a barrel), `lib/` (feature helpers — e.g. `documents/lib/{pdf,chunk,embedding}.ts`), `test/` (colocated vitest specs)
- `src/shared/` — cross-cutting code: `ui/` (shadcn/Base UI primitives), `components/` (shared app components: `Header`, `AccountMenu`, `Logo`, …), `lib/` (`utils.ts` `cn(...)`, `toast.ts`), `config/` (`supabase/`, `i18n/`), `constants/`, `assets/icons/` (HugeIcons re-exports), `test/` (test helpers)
- `src/shared/config/i18n/` — all user-facing strings live in `messages/en.json` (+ `ar.json`), read via `useT()` with full keys (`t("Workspace.previewError")`); keys are type-safe through `src/global.ts`; new locale = code in `config.ts` + `messages/<code>.json`
- `src/layouts/` — page shells (`AuthLayout`, `WorkspaceLayout`, `ProfileLayout`)
- `src/generated/prisma/` — generated client, never edit by hand

## Security (hard requirement)

Every document/chunk row carries a `user_id`, and RLS restricts rows to `auth.uid()`. **The vector similarity search must filter by `user_id` (or run under RLS).** A search that ignores `user_id` leaks other users' chunks — treat this as non-negotiable, not an optimization.

## Scope

In MVP: auth, PDF upload + ingestion, chat with streaming, source citations, "I don't know" fallback, multiple documents.

Out for now (don't build unless I ask): file formats beyond PDF, conversation memory beyond the current thread, teams / roles / sharing, analytics dashboards. If a request would pull these in, flag it before proceeding.

## Conventions

- **One component per file.** A file exports exactly one component. If a component file grows a second component — e.g. a parent that renders a smaller child/sub-component defined inline — extract the child into its own file (colocated in the same folder, wired through the barrel `index.ts`) and import it. Keeps files single-purpose and the tree readable. Small non-component helpers (a local type, a pure formatter, a `cn(...)` call) may stay alongside the component.
- **Readable variable names — never 1–2 characters.** Every identifier must be self-explanatory (`chunk` not `c`, `index` not `i`, `source` not `s`, `part` not `p`, `message` not `m`). This includes loop counters and `map`/`filter`/`forEach` callback params. Applies to all new/edited code; don't refactor unrelated existing short names.
- TypeScript throughout; prefer server components and route handlers.
- Secrets in `.env.local` (see `.env.local.example`): `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `DATABASE_URL` (pooled, runtime), `DIRECT_URL` (migrations).
- Keep model/provider calls behind a thin wrapper module (`src/features/documents/lib/embedding.ts` is the pattern) so the LLM is easy to swap.
