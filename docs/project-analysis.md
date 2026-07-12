# Project Analysis — ai-document-analyzer

> Generated 2026-07-11, refreshed 2026-07-12 after RM-1…RM-5 shipped. Descriptive only — no code was changed by this doc.
> The product is a RAG ("chat with your documents") assistant: users upload PDFs and ask questions in natural language; answers come **only** from their documents, with a file + page citation per answer, and an explicit "I don't know" when the answer isn't present. Demo vertical: **HR / onboarding assistant** (company policies). Built as a portfolio piece.
>
> Per-feature implementation docs live in [features/](./features/); the forward-looking plan and its statuses are in [ROADMAP.md](./ROADMAP.md) (RM-1…RM-5 are all **done**). Known debt is tracked in [TECH_DEBT.md](./TECH_DEBT.md).

---

## 1. Architecture Overview

A single Next.js 16 (App Router) application — there is **no separate backend**. Server work happens in four places: React Server Components (reads), Server Actions (mutations + document ingestion), and two streaming/webhook Route Handlers (`/api/chat`, `/api/stripe/webhook`).

The core design is **RAG with two pipelines over one vector store**:

- **Ingestion** (once per document): upload PDF → Supabase Storage → extract text per page (`unpdf`) → split into overlapping ~1000-char chunks (`src/lib/chunk.ts`, hand-written — no LangChain/LlamaIndex by design) → embed each chunk (`text-embedding-3-small`, 1536 dims) → insert chunk text + embedding + metadata into the `chunks` table (`pgvector`). Plan limits (file size, file count) are enforced **before** ingestion.
- **Query** (per question): plan gate (token/request budget) → embed the question → cosine-similarity search via the `match_chunks` Postgres function (top-k, RLS-scoped to the current user) → build a system prompt containing only the retrieved chunks → stream the `gpt-4o-mini` answer to the client with a `data-sources` UI-message part carrying citations. Token usage is metered back on finish. The model never sees whole documents.

On top of the RAG core sit four supporting concerns added since the MVP: **password recovery**, **billing & plan limits** (Stripe test mode), a **guest/demo mode** (anonymous sign-in), and **global toast** feedback.

Supporting infrastructure:

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript (strict) |
| Auth + DB + Files | Supabase (Postgres + pgvector + Auth via `@supabase/ssr` + Storage), RLS on all user data |
| Schema/migrations | Prisma 7 — **schema + migrations only**, never runtime data access (see §7). Migrations are hand-authored + `prisma:deploy` (see §12) |
| LLM plumbing | Vercel AI SDK v7 (`streamText` + `createUIMessageStream` server-side, `useChat` client-side) |
| Billing | Stripe (test mode) — hosted Checkout + signature-verified webhook, behind a thin `lib/stripe.ts` seam |
| Notifications | Sonner toasts (global `<Toaster>`, `lib/toast.ts` wrapper) |
| Styling/UI | Tailwind CSS v4 + shadcn/ui generated onto **Base UI** primitives (`src/elements/`) |
| i18n | `next-intl`, cookie-based locale (no URL routing), type-safe keys |
| Forms | `react-hook-form` + `zod` (shared client/server schemas) |

**Data clients, strict boundary** (the load-bearing rule of this codebase):

- **Supabase client** ([src/lib/supabase/server.ts](../src/lib/supabase/server.ts), [client.ts](../src/lib/supabase/client.ts)) — *all* user-facing reads/writes. Runs under Row Level Security as the signed-in user.
- **Supabase service-role client** ([src/lib/supabase/admin.ts](../src/lib/supabase/admin.ts)) — **bypasses RLS**; used **only** by the Stripe webhook, which has no user session and looks a profile up by `stripe_customer_id`. Never imported into user-facing paths.
- **Prisma** ([src/lib/prisma.ts](../src/lib/prisma.ts)) — connects as a privileged role and **bypasses RLS**; used exclusively for schema and migrations. Anything Prisma can't model (the Supabase `auth` schema, RLS policies, triggers, storage policies, the vector index and `match_chunks`/`get_usage`/`increment_usage` functions) lives in hand-run SQL scripts under [prisma/sql/](../prisma/sql/).

**Security invariant:** every `documents`/`chunks`/`usage` row carries `user_id`; RLS restricts rows to `auth.uid()`; the vector search filters by `user_id` inside `match_chunks`. A search that skipped this would leak other users' chunks — treated as non-negotiable.

---

## 2. Folder Structure

```
ai-document-analyzer/
├── .claude/skills/          # Project-scoped Claude Code skills (add-ui, commit, db-migrate, i18n-text, rag-pipeline)
├── docs/                    # ROADMAP, TECH_DEBT, this analysis, features/ (per-feature docs)
├── prisma/
│   ├── schema.prisma        # Prisma models: Profile, Document, Chunk, Usage
│   ├── migrations/          # Migrations (hand-authored for cross-schema-FK changes; see §12)
│   └── sql/                 # Hand-run SQL (Supabase SQL Editor): auth_setup, ragSetup, storageSetup, billingSetup, guestCleanup
├── public/                  # Static assets (default create-next-app SVGs)
└── src/
    ├── actions/             # Server Actions ("use server"): auth.ts, documents.ts, billing.ts
    ├── app/                 # Routes — kept deliberately thin (1–5 lines each)
    │   ├── (auth)/          # Route group + AuthLayout: sign-in, sign-up, forgot-password, reset-password, save-account
    │   ├── api/chat/        # POST /api/chat — the RAG query pipeline (streaming)
    │   ├── api/stripe/      # POST /api/stripe/webhook — Stripe subscription sync
    │   ├── auth/            # GET /auth/callback (PKCE code) & /auth/confirm (OTP hash, incl. recovery)
    │   ├── layout.tsx       # Root layout: fonts, locale, NextIntlClientProvider, <Toaster/>
    │   └── page.tsx         # / → HomeContent (branches: landing for guests, workspace for signed-in)
    ├── assets/icons/        # HugeIcons re-exported under semantic names (DocumentIcon, SendIcon…)
    ├── components/          # Feature components, grouped by domain
    │   ├── auth/            # LogoutButton
    │   ├── general/         # Header, SearchInput, UpgradeButton, TryItButton
    │   └── workspace/       # UploadZone, ChatZone, FilePreview, PdfViewer, modals/RemoveDocument
    ├── constants/           # DOCUMENT_STATUSES
    ├── containers/          # Page-level composition (data fetching + state orchestration)
    │   ├── SignIn/ SignUp/ ForgotPassword/ ResetPassword/ SaveAccount/   # Auth forms
    │   ├── Landing/         # Public landing (LandingContent)
    │   └── Workspace/       # WorkspaceContent (server, fetches docs + plan + usage) + Container (client)
    ├── elements/            # shadcn/Base UI primitives: button, input, form, label, dialog, tooltip, sonner
    ├── generated/prisma/    # Generated Prisma client — never edited by hand
    ├── i18n/                # config.ts (locales), request.ts (cookie→locale), messages/en.json, useT hook
    ├── layouts/             # Page shells: AuthLayout (centered card), WorkspaceLayout (header + 3-col grid)
    ├── lib/                 # Domain-agnostic helpers (see §9)
    ├── global.ts            # next-intl module augmentation → type-safe translation keys
    └── middleware.ts        # Delegates to lib/supabase/middleware (session refresh + route guard)
```

**UI layering, top → bottom:** `app/` (routes, thin) → `containers/` (composition, data) → `components/` (feature UI by domain) → `elements/` (design-system primitives), with `layouts/` as page shells. Each folder exposes a barrel `index.ts`.

---

## 3. Business Domains

Five domains, small and cleanly separated:

1. **Identity & access** — email/password sign-up (with email confirmation), sign-in, sign-out; **password recovery** (forgot → reset); **guest sessions** via anonymous sign-in; and **guest → account conversion** (attach email/password to the same user, preserving data). A `profiles` row mirrors each `auth.users` row (created by a DB trigger that also sets the plan). Everything else hangs off `auth.uid()`.
   Code: `src/actions/auth.ts`, `src/containers/{SignIn,SignUp,ForgotPassword,ResetPassword,SaveAccount}`, `src/app/(auth)/`, `src/app/auth/*/route.ts`, `prisma/sql/auth_setup.sql`.

2. **Document management** — upload (drag-drop or picker, PDF only, **plan-dependent size + file-count limits**), ingestion into the vector store with a visible status lifecycle (`pending → processing → ready | error`), inline PDF preview (react-pdf with page scrolling **and cited-chunk highlighting**), deletion (confirm modal; removes chunks via FK cascade and the storage file). Outcomes surface as toasts.
   Code: `src/actions/documents.ts`, `src/components/workspace/UploadZone|FilePreview|PdfViewer`, `src/lib/pdf|chunk|embedding|documents`.

3. **RAG Q&A chat** — streaming chat scoped either to one selected document or to "All documents". Every assistant answer carries clickable source chips (file + page) that jump the PDF preview to the cited page **and highlight the exact retrieved chunk(s)**. The prompt enforces answer-only-from-context. Requests are gated on the plan's token/request budget and metered on finish; a usage meter shows in the chat header.
   Code: `src/app/api/chat/route.ts`, `src/components/workspace/ChatZone.tsx`, `src/lib/chat.ts`, `match_chunks` in `prisma/sql/ragSetup.sql`.

4. **Billing & plan limits** — three plans (`guest | free | pro`) with per-plan file/usage limits (`src/lib/billing.ts`); Stripe test-mode hosted Checkout to upgrade to Pro; a signature-verified webhook syncs subscription status → `profiles.plan`. Usage is metered in the `usage` table.
   Code: `src/actions/billing.ts`, `src/app/api/stripe/webhook/route.ts`, `src/lib/stripe.ts`, `src/lib/billing.ts`, `prisma/sql/billingSetup.sql`.

5. **Guest / demo mode** — a public landing at `/` with a "Try it" CTA that starts an anonymous session; the guest runs the full flow under the strictest plan, can convert to a real account, and is auto-deleted after a TTL by a `pg_cron` job.
   Code: `src/containers/Landing`, `src/components/general/TryItButton.tsx`, `src/actions/auth.ts` (`signInAnonymously`, `convertGuestAccount`), `prisma/sql/guestCleanup.sql`.

Explicitly **out of scope** (per CLAUDE.md): non-PDF formats, cross-thread conversation memory, teams/roles/sharing, analytics dashboards.

---

## 4. Data Flow

### Ingestion (upload → searchable chunks)

```
Browser (UploadZone, client)
 1. validate type=application/pdf, size ≤ plan limit (client pre-check)
 2. supabase.storage.upload("documents", "<userId>/<uuid>.pdf")   ← direct client→Storage, RLS on path prefix
 3. createDocument({ name, storagePath })                          ← Server Action
      ├─ read profiles.plan → plan limits
      ├─ enforce max files (count) + max size (Storage metadata, not the client) — reject + remove object if over
      ├─ insert into documents (status: "pending")
      └─ ingestDocument(id)                                        ← same request, synchronous
           ├─ set status "processing"; download PDF from Storage
           ├─ extractPdfPages (unpdf) → chunkPages(1000/150) → embedChunks (embedMany)
           ├─ delete old chunks, insert new rows (document_id, user_id, content, page, chunk_index, embedding)
           └─ set status "ready" — or "error" on any throw
 4. router.refresh(); toast success/error
```

### Query (question → cited answer)

```
Browser (ChatZone: useChat + DefaultChatTransport)
 → POST /api/chat  { messages, documentIds? }        ← documentIds present when one doc is selected
     ├─ supabase.auth.getUser()  → 401 if no session
     ├─ read profiles.plan + get_usage() → enforce request/token budget → 429 before any paid work
     ├─ embedChunks([question]) → query embedding
     ├─ supabase.rpc("match_chunks", { query_embedding, match_count: 6, match_threshold: 0.2, document_ids })
     │     runs under RLS, filters user_id = auth.uid(), cosine similarity, top-k
     ├─ group chunks by (document, page) → sources[] carrying every chunk's text (snippets, for highlighting)
     ├─ createUIMessageStream:
     │     writer.write({ type: "data-sources", id: "sources", data: sources })   ← citations first
     │     streamText(gpt-4o-mini, instructions = "answer ONLY from context…" + chunks,
     │                onFinish → increment_usage(totalTokens))
     └─ stream merged back as UI messages
 ← ChatZone renders text + source chips; a chip calls onSourceClick(documentId, page, snippets) →
   PreviewContainer selects the doc, PdfViewer scrolls to the page and highlights the chunk text.
   useChat onError → toast.
```

Reads elsewhere are classic RSC: `WorkspaceContent` (server) fetches the documents list, the plan, and current usage with the RLS-scoped Supabase client and passes plain props down; mutations end with `router.refresh()` rather than client caches.

---

## 5. Authentication Flow

Supabase Auth with cookie sessions (`@supabase/ssr`), enforced in three layers:

1. **Middleware** ([src/middleware.ts](../src/middleware.ts) → [src/lib/supabase/middleware.ts](../src/lib/supabase/middleware.ts)) — runs on every request except static assets. Calls `supabase.auth.getUser()` to revalidate/refresh the session cookie, then guards routes: unauthenticated users are redirected to `/sign-in` unless the path is `/` (public landing) or starts with `/sign-in`, `/sign-up`, `/forgot-password`, or `/auth`; authenticated users are bounced away from the sign-in/up pages to `/`.
2. **Server-side re-checks** — `HomeContent` calls `getUser()` and renders the landing (guests) or workspace; `/api/chat` returns 401 without a user; `createDocument`/`convertGuestAccount` return "Not authenticated"; the `/save-account` page redirects non-guests away.
3. **Row Level Security** — even if application checks failed, RLS policies on `profiles`, `documents`, `chunks`, `usage`, and `storage.objects` restrict every row to `auth.uid()`.

**Sign-up:** `SignUpForm` → `signUp` action → re-validates with the same zod schema → `supabase.auth.signUp` with `full_name` in metadata and `emailRedirectTo: <origin>/auth/callback` → confirmation email → link hits **`/auth/callback`** (`exchangeCodeForSession`, PKCE) or **`/auth/confirm`** (`verifyOtp`) → redirect to `/`. The `on_auth_user_created` trigger (SECURITY DEFINER, [auth_setup.sql](../prisma/sql/auth_setup.sql)) inserts the `profiles` row, copying `full_name`/`avatar_url` and setting `plan` (`guest` for anonymous users, else `free`).

**Sign-in:** `signIn` → `signInWithPassword` → `revalidatePath("/", "layout")` + `redirect("/")`. Errors return `{ error }` and land in the form `root` error (kept inline).

**Password recovery (RM-2):** `requestPasswordReset` → `resetPasswordForEmail(email, { redirectTo: /auth/confirm?next=/reset-password })`, always returning a generic message (no email enumeration) → the email link verifies via `/auth/confirm` (recovery-aware: expired links go to `/forgot-password?expired=1`) → `/reset-password` runs `resetPassword` → `updateUser({ password })` → into the app.

**Guest mode (RM-4):** `signInAnonymously` → `supabase.auth.signInAnonymously()` → `/`; the anonymous user reuses RLS/upload/ingest/chat unchanged under the `guest` plan. `convertGuestAccount` → `updateUser({ email, password })` (same `uid`, data preserved) + sets `plan = free`; confirmation email flows through `/auth/confirm`.

**Sign-out:** `signOut` → `supabase.auth.signOut()` → redirect to `/` (the public landing).

Server components can't write cookies, so `createClient()`'s `setAll` swallows that error — the middleware persists refreshed tokens.

---

## 6. API Structure

The mutation surface is mostly **Server Actions**, not REST endpoints:

| Kind | Path / function | Purpose |
|---|---|---|
| Route Handler | `POST /api/chat` | RAG query pipeline; plan gate + usage metering; streams UI messages; `maxDuration = 30` |
| Route Handler | `POST /api/stripe/webhook` | Verifies signature (raw body, node runtime); syncs subscription → `profiles.plan` via the service-role client |
| Route Handler | `GET /auth/callback` | Exchanges the PKCE `code` for a session |
| Route Handler | `GET /auth/confirm` | Verifies the email OTP `token_hash` (sign-up, recovery, email change); recovery-aware redirects |
| Server Action | `signIn`, `signUp`, `signOut`, `requestPasswordReset`, `resetPassword`, `signInAnonymously`, `convertGuestAccount` (`actions/auth.ts`) | Auth mutations |
| Server Action | `createDocument`, `ingestDocument`, `removeDocument`, `getDocumentUrl` (`actions/documents.ts`) | Document lifecycle |
| Server Action | `createCheckoutSession` (`actions/billing.ts`) | Start Stripe Checkout for Pro |

Contract conventions: actions return plain result objects — `{ error?: string }` / `{ error?, message? }` / `{ url?, error? }` — never throw across the boundary; the chat route returns raw `Response` objects (`401`, `429`, `500`, or the UI-message stream); the webhook returns `200`/`400`/`500`. Request body of `/api/chat` is `{ messages: ChatMessage[], documentIds?: string[] }`.

---

## 7. Database Schema

Prisma models + hand-run SQL together define the real schema. Supabase also manages `auth.*` and `storage.*`.

```
auth.users (Supabase-managed)  ── FK cascade to every table below ──
public.profiles                public.documents        public.chunks            public.usage
  id            uuid PK          id           uuid PK    id           uuid PK      id            uuid PK
  email         text?            user_id      uuid       document_id  uuid FK       user_id       uuid
  full_name     text?            name         text       user_id      uuid ← denorm period_start  timestamptz
  avatar_url    text?            storage_path text       content      text         tokens_used   int
  plan          text (free)      mime_type    text       page         int?         requests_used int
  stripe_customer_id     text?   status       text       chunk_index  int          created_at    timestamptz
  stripe_subscription_id text?   created_at   ts         embedding    vector(1536)? updated_at    timestamptz
  subscription_status    text?                           created_at   ts           unique(user_id, period_start)
  created_at / updated_at ts
Indexes: documents(user_id); chunks(user_id); chunks(document_id); usage(user_id);
         chunks_embedding_idx: HNSW on embedding (vector_cosine_ops)
```

- `documents.status` lifecycle: `pending | processing | ready | error` (mirrored in `DOCUMENT_STATUSES`).
- `profiles.plan` ∈ `guest | free | pro` (default `free`; anon → `guest` via trigger). Stripe fields are written by the webhook (service role) and read to gate.
- `chunks.user_id` is deliberately **denormalized** so the vector search filters by owner without a join, RLS-enforceable.
- `usage` — one row per user per calendar month (`period_start = date_trunc('month', now())`); a new month yields a fresh row (the reset).
- **RLS**: `profiles` — owner select/update (insert via trigger only); `documents`/`chunks` — single `FOR ALL` policy `auth.uid() = user_id`; `usage` — **select-only** for owner (no write policy — writes go through the definer function); `storage.objects` — per-operation policies requiring the first path segment to equal `auth.uid()` (files at `<user_id>/<uuid>.pdf` in the private `documents` bucket).
- **SQL functions** (`security definer`/`invoker`, in `prisma/sql`): `match_chunks` (cosine search, RLS + `user_id`-scoped — the *deployed* signature takes `match_count`, `match_threshold`, `document_ids` and joins `documents` for `name`; the repo copy has drifted — **TD-2**); `get_usage()` (current-period counters); `increment_usage(p_tokens)` (SECURITY DEFINER upsert, so users can't reset their own usage); `handle_new_user` (profile + plan trigger); `cleanup_anonymous_users()` (`pg_cron` TTL delete of guests + their storage rows).
- Prisma cannot model `auth`, RLS, triggers, storage policies, or vector/usage functions, so those live in `prisma/sql/{auth_setup,ragSetup,storageSetup,billingSetup,guestCleanup}.sql`, pasted into the Supabase SQL Editor by hand.

---

## 8. State Management

No global state library — state lives at the narrowest scope that works:

- **Server state**: fetched in Server Components (documents list, plan, and current usage in `WorkspaceContent`) and passed down as props. After mutations, clients call `router.refresh()` — no client cache to invalidate. The usage meter is a page-load snapshot (the guest question counter is optimistically bumped by this session's messages).
- **Chat state**: owned by `useChat` (`messages`, `status`, streaming) with `DefaultChatTransport` → `/api/chat`. Citations arrive as a typed `data-sources` part (`ChatMessage = UIMessage<never, { sources: Source[] }>`); each `Source` carries `snippets` for highlighting.
- **UI state**: local `useState` in `PreviewContainer` — selected document, page (citation jumps), highlight snippets, and the mobile tab (`documents | preview | chat`). Children receive callbacks, not a store.
- **Feedback**: **global Sonner toasts** for async-action outcomes (upload/remove, chat errors, checkout errors, "reset link sent"); auth field/root validation and the preview-panel error stay **inline**.
- **Async transitions**: `useTransition` for every server-action call (auth, upload, remove, logout, upgrade, try-it) to drive pending spinners/disabled states.
- **Forms**: `react-hook-form` + `standardSchemaResolver(zodSchema)`; server errors via `form.setError("root", …)`.

Note: `@tanstack/react-query` is listed in the stack and installed, but there is **no `QueryClientProvider` and no `useQuery` anywhere** — still unused (**TD-4**).

---

## 9. Shared Utilities

All in `src/lib/` unless noted:

| Module | Exports | Role |
|---|---|---|
| `utils.ts` | `cn(...)` | `clsx` + `tailwind-merge`; Prettier also sorts classes inside `cn(...)` |
| `pdf.ts` | `extractPdfPages(Uint8Array)` | unpdf text extraction → `[{ page, text }]` |
| `chunk.ts` | `chunkPages`, `IChunk` | Char-window chunker: size 1000, overlap 150, per page |
| `embedding.ts` | `embedChunks(texts)` | Thin wrapper over `embedMany` + `text-embedding-3-small` — the provider seam |
| `chat.ts` | `Source`, `ChatMessage` | Shared chat message typing (incl. `data-sources` part with `snippets`) |
| `documents.ts` | `DOCUMENTS_BUCKET`, `DocumentRow` | Document constants + list row type (file-size limit is now plan-dependent) |
| `billing.ts` | `Plan`, `PlanLimits`, `PlanUsage`, `PLAN_LIMITS`, `getPlanLimits`, `formatTokens` | Plan-limits config + usage helpers — the billing-numbers seam |
| `stripe.ts` | `stripe`, `STRIPE_PRICE_ID`, `planFromSubscriptionStatus` | Stripe client + status→plan mapping — the billing-provider seam |
| `toast.ts` | `toast.success/error` | Thin wrapper over Sonner — the notification seam |
| `validators.ts` | `signIn/signUp/forgotPassword/resetPassword/convertAccount` schemas + types | Single zod source of truth (RHF + server actions) |
| `prisma.ts` | `prisma` | Prisma 7 client — never imported at runtime (**TD-5**) |
| `supabase/server.ts` | `createClient()` | Per-request cookie-bound server client |
| `supabase/client.ts` | `createClient()` | Browser client (anon key; RLS is the protection) |
| `supabase/admin.ts` | `createAdminClient()` | Service-role client, **RLS bypass — webhook only** |
| `supabase/middleware.ts` | `updateSession()` | Session refresh + route guarding |
| `src/i18n/index.ts` | `useT` | Re-exported `useTranslations`, full keys app-wide |
| `src/assets/icons/index.ts` | semantic icon names | HugeIcons re-exports |
| `src/constants/documents.ts` | `DOCUMENT_STATUSES` | Status enum as `const` object |

---

## 10. Reusable Patterns

Patterns to follow when extending the app:

1. **Thin route, fat container.** Every `app/**/page.tsx` is 1–5 lines delegating to a container; data + auth checks live in the (server) container, interactivity in a nested `"use client"` container.
2. **Server-action result objects.** Actions never throw to the client; they return `{ error?, … }`. Callers branch and either `form.setError("root", …)` or fire a toast.
3. **Validate twice with one schema.** The same zod schema runs in the RHF resolver and via `safeParse` at the top of the server action.
4. **Wrapper module per external provider.** `embedChunks` (LLM), `lib/stripe.ts` (billing), `lib/toast.ts` (notifications), `lib/billing.ts` (plan numbers) — swap the provider without touching call sites.
5. **Type-safe i18n, full keys only.** All strings in `messages/en.json`; `useT()` with full keys; validity compile-checked via `src/global.ts`.
6. **Barrel exports per folder** so imports read `@/components/workspace`.
7. **Base UI polymorphism in elements.** `cva` variants + Base UI `useRender`/`mergeProps` with a `render` prop (e.g. `RemoveDocumentModal`'s trigger, `UpgradeButton`-style link buttons) instead of Radix `asChild`.
8. **Client-only heavy deps via `next/dynamic`.** `PdfViewer` (react-pdf + pdfjs worker) is `ssr: false` with a spinner fallback.
9. **Fresh Supabase client per request**; RLS everywhere; denormalize `user_id` onto child rows so policies/searches never join.
10. **Status enums as `as const` objects** (`DOCUMENT_STATUSES`).
11. **Pending UX via `useTransition`** with a consistent inline spinner.
12. **Stale-result guarding in effects** — `FilePreview` tags results with the request's `id`.
13. **Plan-gate before paid work.** Read `profiles.plan` and enforce limits in the upload action and `/api/chat` *before* any OpenAI/embedding call; meter usage on finish.
14. **RLS-bypass only where there is no user.** The service-role client is confined to the Stripe webhook; everything user-facing runs under the session client.
15. **Global toasts for async outcomes.** Fire `toast.success/error` from `lib/toast.ts`; keep form field/root validation inline.

---

## 11. Technical Debt

The tech-debt list lives in **[TECH_DEBT.md](./TECH_DEBT.md)** — the single, living tracker (stable IDs, priority, effort, status). Items referenced above (e.g. **TD-2** `match_chunks` repo/deployed drift, **TD-4** unused react-query, **TD-5** dead runtime Prisma module, **TD-6** i18n leaks / raw server-error strings, **TD-10** rate limiting — partly addressed by RM-3 usage caps) remain open there. This section is intentionally a pointer so the two don't drift.

---

## 12. Coding Conventions

Formatting is machine-enforced (Prettier via lint-staged pre-commit): **tabs**, `printWidth 100`, **double quotes**, semicolons, trailing commas; Tailwind class sorting incl. inside `cn(...)`; ESLint = `eslint-config-next` + `eslint-config-prettier` last.

Code style observed throughout:

- **TypeScript strict**, no `any` in app code; explicit prop interfaces; type-only imports.
- **Named exports only** (sole default exports are Next-required + `extractPdfPages`); **barrel `index.ts`** per folder.
- **Naming:** PascalCase component files, camelCase lib modules; `handle*` handlers, `on*` callback props; snake_case at the DB boundary mapped via `@map`. Readable identifiers — no 1–2-char names.
- **Server-first:** Server Components unless interactivity is needed; `"use client"` on exactly the interactive leaves/containers.
- **Mutations are server actions** returning `{ error? }` result objects.
- **Styling:** Tailwind utilities only; semantic tokens (`bg-background`, `text-foreground/60`, …); conditional classes via `cn(...)`; rounded-2xl + `shadow-sm` surfaces.
- **All user-facing text through `useT()`** with full dotted keys and ICU placeholders.
- **Comments explain *why*** and mark boundaries (RLS/bypass warnings, provider seams).
- **Migrations are hand-authored + `pnpm prisma:deploy`.** `prisma migrate dev` **cannot** be used here: it drift-introspects the live DB and fails (P4002) on the hand-run cross-schema FKs into `auth.users`. New migrations are written by hand to match Prisma's SQL and applied with `deploy` (no shadow DB, no drift check). The RLS/trigger/function SQL in `prisma/sql/*.sql` is pasted into the Supabase SQL Editor by hand.
- **Every shipped feature gets an implementation doc** under `docs/features/` (per CLAUDE.md).
- **pnpm only**; new dependencies require explicit approval; the env contract lives in `.env.local.example` (Supabase, OpenAI, Stripe, app URL).
