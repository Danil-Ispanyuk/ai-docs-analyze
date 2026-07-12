# Project Analysis — ai-document-analyzer

> Generated 2026-07-11 from a full read of the codebase. Descriptive only — no code was changed.
> The product is a RAG ("chat with your documents") assistant: users upload PDFs and ask questions in natural language; answers come **only** from their documents, with a file + page citation per answer, and an explicit "I don't know" when the answer isn't present. Demo vertical: **HR / onboarding assistant** (company policies). Built as a portfolio piece.

---

## 1. Architecture Overview

A single Next.js 16 (App Router) application — there is **no separate backend**. Server work happens in three places: React Server Components (reads), Server Actions (mutations + document ingestion), and one streaming Route Handler (`/api/chat`).

The core design is **RAG with two pipelines over one vector store**:

- **Ingestion** (once per document): upload PDF → Supabase Storage → extract text per page (`unpdf`) → split into overlapping ~1000-char chunks (`src/lib/chunk.ts`, hand-written — no LangChain/LlamaIndex by design) → embed each chunk (`text-embedding-3-small`, 1536 dims) → insert chunk text + embedding + metadata into the `chunks` table (`pgvector`).
- **Query** (per question): embed the question → cosine-similarity search via the `match_chunks` Postgres function (top-k, RLS-scoped to the current user) → build a system prompt containing only the retrieved chunks → stream the `gpt-4o-mini` answer to the client with a `data-sources` UI-message part carrying citations. The model never sees whole documents.

Supporting infrastructure:

| Concern | Choice |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript (strict) |
| Auth + DB + Files | Supabase (Postgres + pgvector + Auth via `@supabase/ssr` + Storage), RLS on all user data |
| Schema/migrations | Prisma 7 — **schema + migrations only**, never runtime data access (see §7) |
| LLM plumbing | Vercel AI SDK v7 (`streamText` + `createUIMessageStream` server-side, `useChat` client-side) |
| Styling/UI | Tailwind CSS v4 + shadcn/ui generated onto **Base UI** primitives (`src/elements/`) |
| i18n | `next-intl`, cookie-based locale (no URL routing), type-safe keys |
| Forms | `react-hook-form` + `zod` (shared client/server schemas) |

**Two data clients, strict boundary** (the load-bearing rule of this codebase):

- **Supabase client** ([src/lib/supabase/server.ts](../src/lib/supabase/server.ts), [client.ts](../src/lib/supabase/client.ts)) — *all* user-facing reads/writes. Runs under Row Level Security as the signed-in user.
- **Prisma** ([src/lib/prisma.ts](../src/lib/prisma.ts)) — connects as a privileged role and **bypasses RLS**; used exclusively for schema and migrations. Anything Prisma can't model (the Supabase `auth` schema, RLS policies, triggers, storage policies, the vector index and `match_chunks` function) lives in hand-run SQL scripts under [prisma/sql/](../prisma/sql/).

**Security invariant:** every `documents`/`chunks` row carries `user_id`; RLS restricts rows to `auth.uid()`; the vector search filters by `user_id` inside `match_chunks`. A search that skipped this would leak other users' chunks — treated as non-negotiable.

---

## 2. Folder Structure

```
ai-document-analyzer/
├── .claude/skills/          # Project-scoped Claude Code skills (add-ui, db-migrate, i18n-text, rag-pipeline)
├── prisma/
│   ├── schema.prisma        # Prisma models: Profile, Document, Chunk
│   ├── migrations/          # Prisma-generated SQL migrations
│   └── sql/                 # Hand-run SQL (Supabase SQL Editor): auth_setup, ragSetup, storageSetup
├── public/                  # Static assets (default create-next-app SVGs)
└── src/
    ├── actions/             # Server Actions ("use server"): auth.ts, documents.ts
    ├── app/                 # Routes — kept deliberately thin (1–5 lines each)
    │   ├── (auth)/          # Route group: /sign-in, /sign-up + auth layout
    │   ├── api/chat/        # POST /api/chat — the RAG query pipeline (streaming)
    │   ├── auth/            # GET /auth/callback (PKCE code) & /auth/confirm (OTP hash)
    │   ├── layout.tsx       # Root layout: fonts, locale, NextIntlClientProvider
    │   └── page.tsx         # / → HomeContent container
    ├── assets/icons/        # HugeIcons re-exported under semantic names (DocumentIcon, SendIcon…)
    ├── components/          # Feature components, grouped by domain
    │   ├── auth/            # LogoutButton
    │   ├── general/         # Header, SearchInput
    │   └── workspace/       # UploadZone, ChatZone, FilePreview, PdfViewer, modals/RemoveDocument
    ├── constants/           # DOCUMENT_STATUSES
    ├── containers/          # Page-level composition (data fetching + state orchestration)
    │   ├── SignIn/ SignUp/  # Auth forms (react-hook-form + server actions)
    │   └── Workspace/       # WorkspaceContent (server, fetches docs) + Container (client, tabs/selection)
    ├── elements/            # shadcn/Base UI primitives: button, input, form, label, dialog, tooltip
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

Three domains, small and cleanly separated:

1. **Identity & access** — email/password sign-up with email confirmation, sign-in, sign-out. A `profiles` row mirrors each `auth.users` row (created by a DB trigger). Everything else in the app hangs off `auth.uid()`.
   Code: `src/actions/auth.ts`, `src/containers/SignIn|SignUp/`, `src/app/(auth)/`, `src/app/auth/*/route.ts`, `prisma/sql/auth_setup.sql`.

2. **Document management** — upload (drag-drop or picker, PDF only, ≤ 25 MB), ingestion into the vector store with a visible status lifecycle (`pending → processing → ready | error`), inline PDF preview (react-pdf with page scrolling), deletion (with confirm modal; removes chunks via FK cascade and the storage file).
   Code: `src/actions/documents.ts`, `src/components/workspace/UploadZone|FilePreview|PdfViewer`, `src/lib/pdf|chunk|embedding|documents`.

3. **RAG Q&A chat** — streaming chat scoped either to one selected document or to "All documents". Every assistant answer carries clickable source chips (file + page) that jump the PDF preview to the cited page. Grounding rule enforced in the prompt: answer only from retrieved context, otherwise say you don't know.
   Code: `src/app/api/chat/route.ts`, `src/components/workspace/ChatZone.tsx`, `src/lib/chat.ts`, `match_chunks` in `prisma/sql/ragSetup.sql`.

Explicitly **out of scope** for the MVP (per CLAUDE.md): non-PDF formats, cross-thread conversation memory, teams/roles/sharing, analytics.

---

## 4. Data Flow

### Ingestion (upload → searchable chunks)

```
Browser (UploadZone, client)
 1. validate type=application/pdf, size ≤ 25 MB
 2. supabase.storage.upload("documents", "<userId>/<uuid>.pdf")   ← direct client→Storage, RLS on path prefix
 3. createDocument({ name, storagePath })                          ← Server Action
      ├─ insert into documents (status: "pending")
      └─ ingestDocument(id)                                        ← same request, synchronous
           ├─ set status "processing"
           ├─ download PDF from Storage
           ├─ extractPdfPages (unpdf)  → [{ page, text }]
           ├─ chunkPages(size 1000, overlap 150)                   ← char-window slicing per page
           ├─ embedChunks (OpenAI text-embedding-3-small, batched via embedMany)
           ├─ delete old chunks for the document, insert new rows
           │    (document_id, user_id ← denormalized, content, page, chunk_index, embedding)
           └─ set status "ready" — or "error" on any throw
 4. router.refresh() → server re-fetches the documents list
```

### Query (question → cited answer)

```
Browser (ChatZone: useChat + DefaultChatTransport)
 → POST /api/chat  { messages, documentIds? }        ← documentIds present when one doc is selected
     ├─ supabase.auth.getUser()  → 401 if no session
     ├─ extract question = text parts of the last message
     ├─ embedChunks([question]) → query embedding
     ├─ supabase.rpc("match_chunks", { query_embedding, match_count: 6, match_threshold: 0.2, document_ids })
     │     runs under RLS, filters user_id = auth.uid(), cosine similarity, top-k
     ├─ dedupe (document, page) pairs → sources[]
     ├─ createUIMessageStream:
     │     writer.write({ type: "data-sources", id: "sources", data: sources })   ← citations first
     │     streamText(gpt-4o-mini, instructions = "answer ONLY from context…" + chunks)
     └─ stream merged back as UI messages
 ← ChatZone renders text parts + source chips; clicking a chip calls
   onSourceClick(documentId, page) → PreviewContainer selects the doc and
   PdfViewer scrollIntoView()s the cited page.
```

Reads elsewhere are classic RSC: `WorkspaceContent` (server component) fetches the documents list with the RLS-scoped Supabase client and passes plain props down; mutations end with `router.refresh()` rather than client caches.

---

## 5. Authentication Flow

Supabase Auth with cookie sessions (`@supabase/ssr`), enforced in three layers:

1. **Middleware** ([src/middleware.ts](../src/middleware.ts) → [src/lib/supabase/middleware.ts](../src/lib/supabase/middleware.ts)) — runs on every request except static assets. Calls `supabase.auth.getUser()` to revalidate/refresh the session cookie, then guards routes: unauthenticated users are redirected to `/sign-in` unless the path starts with `/sign-in`, `/sign-up`, or `/auth`; authenticated users are bounced away from the sign-in/up pages to `/`.
2. **Server-side re-checks** — `HomeContent` calls `getUser()` and redirects again (defense in depth); `/api/chat` returns 401 without a user; `createDocument` returns "Not authenticated".
3. **Row Level Security** — even if application checks failed, RLS policies on `profiles`, `documents`, `chunks`, and `storage.objects` restrict every row to `auth.uid()`.

**Sign-up:** `SignUpForm` (react-hook-form + zod) → `signUp` server action → re-validates with the same zod schema → `supabase.auth.signUp` with `full_name` in user metadata and `emailRedirectTo: <origin>/auth/callback` → user gets a confirmation email → the link hits either **`/auth/callback`** (`exchangeCodeForSession`, PKCE code flow) or **`/auth/confirm`** (`verifyOtp` with `token_hash`, depending on the email template) → redirect to `/`. On the database side, the `on_auth_user_created` trigger (SECURITY DEFINER, [prisma/sql/auth_setup.sql](../prisma/sql/auth_setup.sql)) inserts the matching `profiles` row, copying `full_name`/`avatar_url` from `raw_user_meta_data`.

**Sign-in:** `signIn` action → zod re-validation → `signInWithPassword` → `revalidatePath("/", "layout")` + `redirect("/")`. Errors come back as `{ error }` and land in the form's `root` error.

**Sign-out:** `signOut` action → `supabase.auth.signOut()` → redirect to `/sign-in`.

Server components can't write cookies, so `createClient()`'s `setAll` swallows that error — the middleware is the component that actually persists refreshed tokens.

---

## 6. API Structure

The mutation surface is mostly **Server Actions**, not REST endpoints:

| Kind | Path / function | Purpose |
|---|---|---|
| Route Handler | `POST /api/chat` | RAG query pipeline; streams UI messages; `maxDuration = 30` |
| Route Handler | `GET /auth/callback` | Exchanges the PKCE `code` for a session; redirects to `next` or `/sign-in?error=…` |
| Route Handler | `GET /auth/confirm` | Verifies the email OTP `token_hash`; same redirect pattern |
| Server Action | `signIn`, `signUp`, `signOut` (`src/actions/auth.ts`) | Auth mutations |
| Server Action | `createDocument` (`src/actions/documents.ts`) | Insert `documents` row, then ingest |
| Server Action | `ingestDocument` | The full ingestion pipeline (also callable standalone for re-ingest) |
| Server Action | `removeDocument` | Delete row (chunks cascade) + storage file |
| Server Action | `getDocumentUrl` | 10-minute signed URL for the PDF preview |

Contract conventions: actions return plain result objects — `{ error?: string }` or `{ error?, message? }` / `{ url?, error? }` — never throw across the boundary; the chat route returns raw `Response` objects (`401`, `500`, or the UI-message stream). Request body of `/api/chat` is `{ messages: ChatMessage[], documentIds?: string[] }`; `documentIds` narrows retrieval to the selected document.

---

## 7. Database Schema (inferred)

Prisma models + hand-run SQL together define the real schema. Supabase also manages `auth.*` and `storage.*`.

```
auth.users (Supabase-managed)
  ▲ id                                  ▲ id                       ▲ id
  │ FK, cascade                         │ FK, cascade              │ FK, cascade
public.profiles                 public.documents            public.chunks
  id          uuid PK = auth uid    id           uuid PK        id           uuid PK
  email       text?                 user_id      uuid  ──┐      document_id  uuid FK→documents (cascade)
  full_name   text?                 name         text    │      user_id      uuid   ← denormalized for RLS/vector search
  avatar_url  text?                 storage_path text    │      content      text
  created_at  timestamptz           mime_type    text    │      page         int?
  updated_at  timestamptz           status       text ◄──┘      chunk_index  int
                                    created_at   timestamptz    embedding    vector(1536)?
                                                                created_at   timestamptz
Indexes: documents(user_id); chunks(user_id); chunks(document_id);
         chunks_embedding_idx: HNSW on embedding (vector_cosine_ops)
```

- `documents.status` is a plain text lifecycle: `pending | processing | ready | error` (mirrored in `DOCUMENT_STATUSES`).
- `chunks.user_id` is deliberately **denormalized** from the parent document so the vector search can filter by owner without a join and stay RLS-enforceable.
- **RLS** (from `prisma/sql/*.sql`): `profiles` — owner may select/update (insert via trigger only, delete via FK cascade); `documents` & `chunks` — single `FOR ALL` policy `auth.uid() = user_id`; `storage.objects` — per-operation policies requiring the first path segment of the object name to equal `auth.uid()` (files live at `<user_id>/<uuid>.pdf` in the private `documents` bucket).
- **`match_chunks(query_embedding vector(1536), match_count int)`** — `security invoker` SQL function: cosine similarity (`1 - (embedding <=> query)`), `where user_id = auth.uid() and embedding is not null`, ordered by distance, `limit match_count`. ⚠️ The *deployed* version has drifted from this repo copy — see §11.
- Prisma cannot model the `auth` schema, RLS, triggers, storage policies, or the vector index/function, so those live in `prisma/sql/{auth_setup,ragSetup,storageSetup}.sql` and are pasted into the Supabase SQL Editor manually after `prisma migrate`.

---

## 8. State Management

No global state library — state lives at the narrowest scope that works:

- **Server state**: fetched in Server Components (e.g. the documents list in `WorkspaceContent`) and passed down as props. After mutations, clients call `router.refresh()` to re-run the server render — no client cache to invalidate.
- **Chat state**: owned by the AI SDK's `useChat` hook (`messages`, `status`, streaming) with `DefaultChatTransport` pointed at `/api/chat`. Citations arrive as a typed `data-sources` message part (`ChatMessage = UIMessage<never, { sources: Source[] }>`), so sources are part of the message model rather than separate state.
- **UI state**: local `useState` in `PreviewContainer` — selected document, selected page (for citation jumps), and the mobile tab (`documents | preview | chat`; on ≥ md all three panels show side by side). Child components receive callbacks (`handleSelectDocument`, `onSourceClick`) rather than sharing a store.
- **Async transitions**: `useTransition` for every server-action call (sign-in/up, upload, remove, logout) to drive pending spinners/disabled states.
- **Forms**: `react-hook-form` with `standardSchemaResolver(zodSchema)`; server-side errors are surfaced via `form.setError("root", …)`.

Note: `@tanstack/react-query` is listed in the stack and installed, but there is **no `QueryClientProvider` and no `useQuery` anywhere** — it is currently unused (see §11).

---

## 9. Shared Utilities

All in `src/lib/` unless noted:

| Module | Exports | Role |
|---|---|---|
| `utils.ts` | `cn(...)` | `clsx` + `tailwind-merge`; Prettier also sorts classes inside `cn(...)` |
| `pdf.ts` | `extractPdfPages(Uint8Array)` | unpdf text extraction → `[{ page, text }]`, whitespace-normalized |
| `chunk.ts` | `chunkPages`, `IChunk` | Char-window chunker: default size 1000, overlap 150, per page |
| `embedding.ts` | `embedChunks(texts)` | Thin wrapper over `embedMany` + `text-embedding-3-small` — the designated seam for swapping providers |
| `chat.ts` | `Source`, `ChatMessage` | Shared client/server chat message typing (incl. the `data-sources` part) |
| `documents.ts` | `DOCUMENTS_BUCKET`, `MAX_FILE_SIZE`, `DocumentRow` | Document constants + list row type |
| `validators.ts` | `signInSchema`, `signUpSchema` + inferred types | Single zod source of truth used by both RHF and server actions |
| `prisma.ts` | `prisma` | Prisma 7 client via `PrismaPg` adapter (pooled `DATABASE_URL`), hot-reload singleton — currently never imported at runtime |
| `supabase/server.ts` | `createClient()` | Per-request cookie-bound server client (never cached across requests) |
| `supabase/client.ts` | `createClient()` | Browser client (anon key; RLS is the protection) |
| `supabase/middleware.ts` | `updateSession()` | Session refresh + route guarding |
| `src/i18n/index.ts` | `useT` | Re-exported `useTranslations`, used with full keys app-wide |
| `src/assets/icons/index.ts` | semantic icon names | HugeIcons re-exports (`File01Icon as DocumentIcon`, …) |
| `src/constants/documents.ts` | `DOCUMENT_STATUSES` | Status string enum as `const` object |

---

## 10. Reusable Patterns

Patterns to follow when extending the app:

1. **Thin route, fat container.** Every `app/**/page.tsx` is 1–5 lines delegating to a container from `@/containers`. Data fetching and auth checks live in the (server) container; interactivity in a nested `"use client"` container.
2. **Server-action result objects.** Actions never throw to the client; they return `{ error?: string, … }`. Callers branch on `result?.error` and either `form.setError("root", …)` or set local error state.
3. **Validate twice with one schema.** The same zod schema runs in the RHF resolver client-side and via `safeParse` at the top of the server action.
4. **Wrapper module per external model/provider.** `embedChunks` is the canonical example — model calls go behind a thin `lib/` function so the provider is swappable.
5. **Type-safe i18n, full keys only.** All user-facing strings live in `messages/en.json`; components call `useT()` and pass full keys (`t("Workspace.previewError")`); key validity is compile-checked via the `next-intl` module augmentation in `src/global.ts`. New locale = one line in `i18n/config.ts` + one JSON file.
6. **Barrel exports per folder** (`components/workspace/index.ts`, `containers/index.ts`, `layouts/index.ts`) so imports read `@/components/workspace`.
7. **Base UI polymorphism in elements.** Primitives use `cva` for variants and Base UI's `useRender`/`mergeProps` with a `render` prop instead of Radix's `asChild` — e.g. `RemoveDocumentModal` passes its trigger element via `<DialogTrigger render={children} />` so Base UI turns it *into* the trigger rather than nesting buttons.
8. **Client-only heavy dependencies via `next/dynamic`.** `PdfViewer` (react-pdf + pdfjs worker) is loaded with `ssr: false` and a spinner fallback from `FilePreview`.
9. **Fresh Supabase client per request** on the server; RLS everywhere; denormalize `user_id` onto child rows so policies and searches never need joins.
10. **Status enums as `as const` objects** (`DOCUMENT_STATUSES`) referenced from both actions and UI badges.
11. **Pending UX via `useTransition`** with a consistent inline spinner (`animate-spin rounded-full border-2 border-current border-t-transparent`).
12. **Stale-result guarding in effects** — `FilePreview` tags results with the request's `id` and ignores responses for a no-longer-selected document.

---

## 11. Technical Debt

The tech-debt list that lived here has moved to **[TECH_DEBT.md](./TECH_DEBT.md)** — the
single, living tracker (stable IDs, priority, effort, status), kept up to date as debt
is paid. The 14 items catalogued in this snapshot (dated in the header above) were
folded in there on 2026-07-12 as TD-1 … TD-15. See TECH_DEBT.md for the current list;
this section is intentionally a pointer so the two don't drift.

---

## 12. Coding Conventions

Formatting is machine-enforced (Prettier via lint-staged pre-commit):

- **Tabs**, `printWidth: 100`, **double quotes**, semicolons, trailing commas everywhere.
- Tailwind class sorting via `prettier-plugin-tailwindcss`, including inside `cn(...)` (`tailwindFunctions: ["cn"]`), against the Tailwind v4 CSS entry.
- ESLint: `eslint-config-next` (core-web-vitals + TS) with `eslint-config-prettier` last.

Code style observed throughout:

- **TypeScript strict**, no `any` in app code; explicit prop interfaces; type-only imports (`import type …`).
- **Named exports only** (the sole default exports are Next-required: pages, layouts, route configs, plus `extractPdfPages`); **barrel `index.ts`** per feature folder.
- **Naming:** PascalCase files for components (`UploadZone.tsx`), camelCase for lib modules (`chunk.ts`); `handle*` for event handlers, `on*` for callback props; snake_case at the DB boundary mapped to camelCase in Prisma via `@map`.
- **Server-first:** components are Server Components unless they need interactivity; `"use client"` sits at the top of exactly the interactive leaves/containers.
- **Mutations are server actions** returning `{ error? }` result objects — never thrown errors, never ad-hoc API routes.
- **Styling:** Tailwind utilities only, no CSS modules; semantic design tokens (`bg-background`, `text-foreground/60`, `border-border`, `text-destructive`); conditional classes always through `cn(...)`; rounded-2xl cards + `shadow-sm` as the shared surface idiom.
- **All user-facing text through `useT()`** with full dotted keys; ICU placeholders (`{email}`, `{scope}`); type-safe via module augmentation.
- **Comments explain *why* and mark boundaries** (RLS/bypass warnings, "do not run code between createServerClient and getUser()"), written above the code they govern. Header comments on infra modules state the module's contract.
- **Accessibility touches:** `aria-label` on icon buttons, `role="alert"` on form errors, `aria-hidden` on decorative spinners, keyboard handlers (`Enter`/`Space`) on div-based buttons, `focus-visible` rings on all interactive elements.
- **pnpm only** — never npm or yarn; new dependencies require explicit approval (per CLAUDE.md); the environment contract lives in `.env.local.example` with per-variable comments.
