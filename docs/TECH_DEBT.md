# Tech Debt

Known shortcuts, drift, and rough edges in the **existing** code — things that work
today but should be cleaned up. New features and enhancements go in
[ROADMAP.md](./ROADMAP.md), not here.

This is the **single source of truth** for tech debt. The list in
[project-analysis.md §11](./project-analysis.md) was folded in here (2026-07-12) — go
by this file; it's the one that gets updated as debt is paid.

> Planning-only doc. Nothing here touches code until it's picked up as an explicit
> task. Keep entries short; delete them when the debt is paid.

## Legend

- **Priority** — 🔴 high (risk / blocks work) · 🟡 medium · 🟢 low (nice to clean up)
- **Effort** — S (`< 1h`) · M (few hours) · L (day+)
- **Status** — `open` · `in-progress` · `done`

## Summary (by impact)

| ID | Title | Area | Prio | Effort | Status |
|----|-------|------|------|--------|--------|
| TD-2  | `match_chunks` drift — repo SQL can't rebuild the deployed DB | `ragSetup.sql` ↔ `route.ts` | 🔴 | M | open |
| TD-3  | Ingestion is synchronous inside the upload action | `actions/documents.ts` | 🟡 | L | open |
| TD-10 | No rate limiting / cost controls on `/api/chat` | `api/chat/route.ts` | 🟡 | M | open |
| TD-12 | Signed preview URLs expire silently (10 min) | `actions/documents.ts` | 🟡 | M | open |
| TD-6  | i18n / language leaks (hardcoded Cyrillic, comments, typo) | multiple | 🟡 | S | open |
| TD-8  | No tests, no CI | repo-wide | 🟡 | L | open |
| TD-1  | Inline `Spinner` in `PdfViewer.tsx` (one-component-per-file) | `components/workspace/PdfViewer.tsx` | 🟢 | S | open |
| TD-4  | Unused dependency `@tanstack/react-query` | `package.json` | 🟢 | S | open |
| TD-5  | Dead runtime module `src/lib/prisma.ts` | `lib/prisma.ts` | 🟢 | S | open |
| TD-7  | Decorative `SearchInput` (no behavior) | `components/general` | 🟢 | S | open |
| TD-9  | Stock create-next-app boilerplate never replaced | `README.md`, `layout.tsx`, `public/` | 🟢 | S | open |
| TD-11 | Deletion ordering can orphan storage files | `actions/documents.ts` | 🟢 | M | open |
| TD-13 | Chunker is purely character-based | `lib/chunk.ts` | 🟢 | M | open |
| TD-14 | Minor naming / inert-class inconsistencies | multiple | 🟢 | S | open |
| TD-15 | Three fonts loaded, only `font-sans` used | `app/layout.tsx` | 🟢 | S | open |

## Items

### TD-1 · Inline `Spinner` in `PdfViewer.tsx` — one-component-per-file violation

- **Area:** `src/components/workspace/PdfViewer.tsx`
- **Problem:** The file defines two components — `PdfViewer` (main) and an inline
  `Spinner` (child, lines 13–22). Violates the "one component per file" convention
  (`CLAUDE.md → Conventions`).
- **Fix:** Extract to `src/components/general/Spinner.tsx`, wire through the `general`
  barrel, import into `PdfViewer`. (The `useTransition` spinner idiom in TD-14 could
  reuse the same component.)
- **Effort:** S · **Priority:** 🟢 low · **Status:** open

### TD-2 · `match_chunks` drift — repo SQL can't rebuild the deployed DB

- **Area:** `prisma/sql/ragSetup.sql` ↔ `src/app/api/chat/route.ts`
- **Problem:** The checked-in SQL defines
  `match_chunks(query_embedding, match_count)` returning `(id, document_id, content,
  page, similarity)`. The app calls it with **4 args** (`match_count`,
  `match_threshold: 0.2`, `document_ids` — `route.ts:41–46`) and reads a **`name`
  column** (`route.ts:58, 63`) that the repo return table doesn't have. The deployed
  function was updated in the Supabase SQL Editor without back-porting to the repo.
- **Impact:** 🔴 High. Re-running `ragSetup.sql` would replace the live function with
  a signature the app never calls (unknown named args → RPC error, and no `name`) —
  breaking chat. The source of truth for the security-sensitive RAG search is out of
  sync; `CLAUDE.md` explicitly requires keeping these aligned.
- **Fix:** Reconcile `ragSetup.sql` to the deployed signature — add `match_threshold`
  + `document_ids` params and their `where` filters, and the `name` column (join to
  `documents`). Verify against the live function in the SQL Editor before overwriting.
- **Effort:** M · **Priority:** 🔴 high · **Status:** open

### TD-3 · Ingestion is synchronous inside the upload server action

- **Area:** `src/actions/documents.ts` (`createDocument` → `ingestDocument`)
- **Problem:** `createDocument` awaits the whole extract → chunk → embed → insert
  pipeline in one request; no `maxDuration` on the action. Large PDFs risk serverless
  timeouts, and the user waits on "Uploading…" for the entire pipeline. A failed doc
  can only be retried by delete + re-upload (no re-ingest button, though
  `ingestDocument` is exported and standalone-capable).
- **Fix:** Move ingestion to a background/queued path; the `status` column already
  supports it. Add a re-ingest action for `error` docs.
- **Effort:** L · **Priority:** 🟡 medium · **Status:** open

### TD-4 · Unused dependency: `@tanstack/react-query`

- **Area:** `package.json` / documented stack
- **Problem:** Listed and installed, but no `QueryClientProvider` and no `useQuery`
  anywhere — currently dead surface.
- **Fix:** Either wire it in (e.g. documents list / signed URLs) or drop it from the
  stack + `package.json`.
- **Effort:** S · **Priority:** 🟢 low · **Status:** open

### TD-5 · Dead runtime module: `src/lib/prisma.ts`

- **Area:** `src/lib/prisma.ts`
- **Problem:** The Prisma client singleton is never imported at runtime (consistent
  with "Prisma = migrations only"), so the runtime client + `@prisma/adapter-pg`
  dependency are unnecessary surface.
- **Fix:** Remove the runtime singleton (keep Prisma for schema/migrations only) or
  document why it stays.
- **Effort:** S · **Priority:** 🟢 low · **Status:** open

### TD-6 · i18n / language leaks

- **Area:** `ChatZone.tsx`, `api/chat/route.ts`, `messages/en.json`
- **Problem:** Hardcoded Cyrillic in a user-facing string — `ChatZone` renders
  `· с.${page}` instead of a translated key (violates the "all strings through
  next-intl" rule). Ukrainian/mixed-language comments in `route.ts` and elsewhere.
  Unused key `Workspace.chatEmpty`; grammatical typo in `Auth.existAccount`
  ("Do you have account?").
- **Fix:** Route the page-citation string through `useT()`; normalize comments to
  English; remove the unused key; fix the copy.
- **Effort:** S · **Priority:** 🟡 medium · **Status:** open

### TD-7 · Decorative search box

- **Area:** `src/components/general` (`Header` → `SearchInput`)
- **Problem:** `SearchInput` has no state, handler, or filtering — it looks functional
  but does nothing.
- **Fix:** Wire it to filter the documents list, or remove it until there's a use.
- **Effort:** S · **Priority:** 🟢 low · **Status:** open

### TD-8 · No tests, no CI

- **Area:** repo-wide
- **Problem:** Only Husky + lint-staged (Prettier) on commit. The chunker, the
  `match_chunks` contract, and action error paths are all untested; nothing runs on
  push.
- **Fix:** Add a test runner + a few high-value tests (chunker, action error paths)
  and a minimal CI workflow (lint + typecheck + test).
- **Effort:** L · **Priority:** 🟡 medium · **Status:** open

### TD-9 · Stock create-next-app boilerplate never replaced

- **Area:** `README.md`, `src/app/layout.tsx`, `public/`
- **Problem:** `README.md` is stock create-next-app (even suggests npm/yarn,
  contradicting the pnpm-only rule); root `metadata` is still "Create Next App";
  `public/` still holds the template SVGs. Weak for a portfolio piece.
- **Fix:** Write a real README, set proper `metadata`, remove template assets.
- **Effort:** S · **Priority:** 🟢 low · **Status:** open

### TD-10 · No rate limiting / cost controls on `/api/chat`

- **Area:** `src/app/api/chat/route.ts`
- **Problem:** Every message costs an embedding + completion call; a signed-in user
  can hammer the endpoint with no throttle or budget cap.
- **Impact:** Cost/abuse exposure. Becomes a prerequisite before opening the app to
  guests / the public — see ROADMAP **RM-4** (guest mode) and **RM-3** (plan limits).
- **Fix:** Add per-user rate limiting and/or a usage counter; share the limit model
  with RM-3's plan gating.
- **Effort:** M · **Priority:** 🟡 medium · **Status:** open

### TD-11 · Deletion ordering can orphan storage files

- **Area:** `src/actions/documents.ts` (`removeDocument`)
- **Problem:** Deletes the DB row first, then the storage object; a storage failure is
  only `console.error`'d ("orphan file"). Accepted trade-off, but there is no cleanup
  path.
- **Fix:** Delete storage first (or add a reconciliation/cleanup job for orphans).
- **Effort:** M · **Priority:** 🟢 low · **Status:** open

### TD-12 · Signed preview URLs expire silently

- **Area:** `src/actions/documents.ts` (`getDocumentUrl`)
- **Problem:** Issues a 10-minute signed URL; a preview left open longer starts
  failing page loads with no refresh mechanism.
- **Fix:** Refresh the signed URL on expiry (or on load error) before rendering pages.
- **Effort:** M · **Priority:** 🟡 medium · **Status:** open

### TD-13 · Chunker is purely character-based

- **Area:** `src/lib/chunk.ts`
- **Problem:** Char-window slicing (size 1000, overlap 150) splits mid-word /
  mid-sentence with no sentence/paragraph awareness; whitespace normalization also
  discards layout that could improve retrieval quality.
- **Fix:** Add sentence/paragraph-aware boundaries. Fine for MVP — quality
  improvement, not a bug.
- **Effort:** M · **Priority:** 🟢 low · **Status:** open

### TD-14 · Minor naming / inert-class inconsistencies

- **Area:** multiple
- **Problem:** Interface naming mixes `I`-prefix (`IChunk`, `ISearchInput`,
  `IRemoveDocument`) with `*Props` (`UploadZoneProps`, `PdfViewerProps`). Workspace
  file/component names don't match (`Container.tsx` exports `PreviewContainer`;
  `WorkspaceContent.tsx` exports `HomeContent`). `SearchInput` uses
  `className="max-w-[500]"` (missing unit → the class is inert). The `pending` status
  renders no badge at all.
- **Fix:** Pick one interface convention (`*Props`), align file ↔ component names, fix
  `max-w-[500px]`, add a `pending` badge.
- **Effort:** S · **Priority:** 🟢 low · **Status:** open

### TD-15 · Three fonts loaded, only one used

- **Area:** `src/app/layout.tsx`
- **Problem:** Figtree + Geist Sans + Geist Mono are all loaded while `font-sans` is
  the only family visibly used — Geist looks like template residue.
- **Fix:** Drop the unused font imports.
- **Effort:** S · **Priority:** 🟢 low · **Status:** open
