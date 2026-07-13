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

Code-complete items are `done`. The four 🔴 infra items are `verify`: their code + SQL
are in the repo, but they must be applied/confirmed against the live Supabase/Stripe
setup (run the migration, paste the `prisma/sql` scripts, `stripe listen`, a fresh
sign-up) before they're truly paid.

| ID    | Title                                                                  | Area                                    | Prio | Effort | Status      |
| ----- | ---------------------------------------------------------------------- | --------------------------------------- | ---- | ------ | ----------- |
| TD-18 | Plan not updated after successful payment                              | Stripe webhook / checkout               | 🔴   | M      | verify      |
| TD-19 | Chat token usage not counted (metering doesn't land)                   | `api/chat/route.ts` ↔ `increment_usage` | 🔴   | M      | verify      |
| TD-20 | `profiles` row empty after account creation                            | `auth_setup.sql` trigger                | 🔴   | M      | verify      |
| TD-2  | `match_chunks` drift — repo SQL can't rebuild the deployed DB          | `ragSetup.sql` ↔ `route.ts`             | 🔴   | M      | verify      |
| TD-3  | Ingestion is synchronous inside the upload action                      | `actions/documents.ts`                  | 🟡   | L      | done        |
| TD-10 | No rate limiting / cost controls on `/api/chat`                        | `api/chat/route.ts`                     | 🟡   | M      | verify      |
| TD-12 | Signed preview URLs expire silently (10 min)                           | `actions/documents.ts`                  | 🟡   | M      | done        |
| TD-6  | i18n / language leaks (hardcoded Cyrillic, comments, typo)             | multiple                                | 🟡   | S      | done        |
| TD-8  | No tests, no CI                                                        | repo-wide                               | 🟡   | L      | done        |
| TD-1  | Inline `Spinner` in `PdfViewer.tsx` (one-component-per-file)           | `components/workspace/PdfViewer.tsx`    | 🟢   | S      | done        |
| TD-4  | Unused dependency `@tanstack/react-query`                              | `package.json`                          | 🟢   | S      | done        |
| TD-5  | Dead runtime module `src/lib/prisma.ts`                                | `lib/prisma.ts`                         | 🟢   | S      | done        |
| TD-7  | Decorative `SearchInput` (no behavior)                                 | `components/general`                    | 🟢   | S      | done        |
| TD-9  | Stock create-next-app boilerplate never replaced                       | `README.md`, `layout.tsx`, `public/`    | 🟢   | S      | done        |
| TD-11 | Deletion ordering can orphan storage files                             | `actions/documents.ts`                  | 🟢   | M      | done        |
| TD-13 | Chunker is purely character-based                                      | `lib/chunk.ts`                          | 🟢   | M      | done        |
| TD-14 | Minor naming / inert-class inconsistencies                             | multiple                                | 🟢   | S      | done        |
| TD-15 | Three fonts loaded, only `font-sans` used                              | `app/layout.tsx`                        | 🟢   | S      | done        |
| TD-16 | Drop cited-chunk text highlighting — jump to page only                 | citation / PDF preview                  | 🟡   | S      | done        |
| TD-17 | Collapse source chips to one page + `+N` picker                        | `chat` / `workspace`                    | 🟡   | M      | done        |
| TD-21 | Back navigation from the Profile page (logo + back arrow)              | profile / header                        | 🟢   | S      | done        |
| TD-22 | Show/hide password toggle on the profile password field                | profile / auth                          | 🟢   | S      | done        |
| TD-24 | Document delete is unresponsive + "Cannot coerce … single JSON object" | `features/documents/actions.ts`         | 🔴   | M      | done        |
| TD-25 | "All documents" chat resurrects after deleting all files               | `features/chat` / workspace             | 🔴   | M      | done        |
| TD-27 | Errored (unindexed) docs still listed / previewable                    | documents list / preview                | 🟡   | M      | done        |
| TD-28 | Profile label "Name" → "Full Name"                                     | profile form                            | 🟢   | S      | done        |
| TD-29 | Replace "Signed in as" with "Hello, {fullName}"                        | profile / header                        | 🟢   | S      | done        |
| TD-31 | Delete-file icon not discoverable (mobile + desktop)                   | documents list UI                       | 🟡   | S      | done        |
| TD-32 | Cross-device session invalidation / empty file list                    | auth session / documents sync           | 🔴   | M      | in-progress |

## Items

### TD-1 · Inline `Spinner` in `PdfViewer.tsx` — one-component-per-file violation

- **Area:** `src/components/workspace/PdfViewer.tsx`
- **Problem:** The file defines two components — `PdfViewer` (main) and an inline
  `Spinner` (child, lines 13–22). Violates the "one component per file" convention
  (`CLAUDE.md → Conventions`).
- **Fix:** Extract to `src/components/general/Spinner.tsx`, wire through the `general`
  barrel, import into `PdfViewer`. (The `useTransition` spinner idiom in TD-14 could
  reuse the same component.)
- **Effort:** S · **Priority:** 🟢 low · **Status:** done

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
  - `document_ids` params and their `where` filters, and the `name` column (join to
    `documents`). Verify against the live function in the SQL Editor before overwriting.
- **Effort:** M · **Priority:** 🔴 high · **Status:** done (code+SQL ready — verify on live Supabase/Stripe)

### TD-3 · Ingestion is synchronous inside the upload server action

- **Area:** `src/actions/documents.ts` (`createDocument` → `ingestDocument`)
- **Problem:** `createDocument` awaits the whole extract → chunk → embed → insert
  pipeline in one request; no `maxDuration` on the action. Large PDFs risk serverless
  timeouts, and the user waits on "Uploading…" for the entire pipeline. A failed doc
  can only be retried by delete + re-upload (no re-ingest button, though
  `ingestDocument` is exported and standalone-capable).
- **Fix:** Move ingestion to a background/queued path; the `status` column already
  supports it. Add a re-ingest action for `error` docs.
- **Effort:** L · **Priority:** 🟡 medium · **Status:** done

### TD-4 · Unused dependency: `@tanstack/react-query`

- **Area:** `package.json` / documented stack
- **Problem:** Listed and installed, but no `QueryClientProvider` and no `useQuery`
  anywhere — currently dead surface.
- **Fix:** Either wire it in (e.g. documents list / signed URLs) or drop it from the
  stack + `package.json`.
- **Effort:** S · **Priority:** 🟢 low · **Status:** done

### TD-5 · Dead runtime module: `src/lib/prisma.ts`

- **Area:** `src/lib/prisma.ts`
- **Problem:** The Prisma client singleton is never imported at runtime (consistent
  with "Prisma = migrations only"), so the runtime client + `@prisma/adapter-pg`
  dependency are unnecessary surface.
- **Fix:** Remove the runtime singleton (keep Prisma for schema/migrations only) or
  document why it stays.
- **Effort:** S · **Priority:** 🟢 low · **Status:** done

### TD-6 · i18n / language leaks

- **Area:** `ChatZone.tsx`, `api/chat/route.ts`, `messages/en.json`
- **Problem:** Hardcoded Cyrillic in a user-facing string — `ChatZone` renders
  `· с.${page}` instead of a translated key (violates the "all strings through
  next-intl" rule). Ukrainian/mixed-language comments in `route.ts` and elsewhere.
  Unused key `Workspace.chatEmpty`; grammatical typo in `Auth.existAccount`
  ("Do you have account?").
- **Fix:** Route the page-citation string through `useT()`; normalize comments to
  English; remove the unused key; fix the copy.
- **Effort:** S · **Priority:** 🟡 medium · **Status:** done

### TD-7 · Decorative search box

- **Area:** `src/components/general` (`Header` → `SearchInput`)
- **Problem:** `SearchInput` has no state, handler, or filtering — it looks functional
  but does nothing.
- **Fix:** Wire it to filter the documents list, or remove it until there's a use.
- **Effort:** S · **Priority:** 🟢 low · **Status:** done

### TD-8 · No tests, no CI

- **Area:** repo-wide
- **Problem:** Only Husky + lint-staged (Prettier) on commit. The chunker, the
  `match_chunks` contract, and action error paths are all untested; nothing runs on
  push.
- **Fix:** Add a test runner + a few high-value tests (chunker, action error paths)
  and a minimal CI workflow (lint + typecheck + test).
- **Effort:** L · **Priority:** 🟡 medium · **Status:** done

### TD-9 · Stock create-next-app boilerplate never replaced

- **Area:** `README.md`, `src/app/layout.tsx`, `public/`
- **Problem:** `README.md` is stock create-next-app (even suggests npm/yarn,
  contradicting the pnpm-only rule); root `metadata` is still "Create Next App";
  `public/` still holds the template SVGs. Weak for a portfolio piece.
- **Fix:** Write a real README, set proper `metadata`, remove template assets.
- **Effort:** S · **Priority:** 🟢 low · **Status:** done

### TD-10 · No rate limiting / cost controls on `/api/chat`

- **Area:** `src/app/api/chat/route.ts`
- **Problem:** Every message costs an embedding + completion call; a signed-in user
  can hammer the endpoint with no throttle or budget cap.
- **Impact:** Cost/abuse exposure. Becomes a prerequisite before opening the app to
  guests / the public — see ROADMAP **RM-4** (guest mode) and **RM-3** (plan limits).
- **Fix:** Add per-user rate limiting and/or a usage counter; share the limit model
  with RM-3's plan gating.
- **Effort:** M · **Priority:** 🟡 medium · **Status:** done (code ready — apply `prisma/sql/rateLimitSetup.sql` + migration on live DB)

### TD-11 · Deletion ordering can orphan storage files

- **Area:** `src/actions/documents.ts` (`removeDocument`)
- **Problem:** Deletes the DB row first, then the storage object; a storage failure is
  only `console.error`'d ("orphan file"). Accepted trade-off, but there is no cleanup
  path.
- **Fix:** Delete storage first (or add a reconciliation/cleanup job for orphans).
- **Effort:** M · **Priority:** 🟢 low · **Status:** done

### TD-12 · Signed preview URLs expire silently

- **Area:** `src/actions/documents.ts` (`getDocumentUrl`)
- **Problem:** Issues a 10-minute signed URL; a preview left open longer starts
  failing page loads with no refresh mechanism.
- **Fix:** Refresh the signed URL on expiry (or on load error) before rendering pages.
- **Effort:** M · **Priority:** 🟡 medium · **Status:** done

### TD-13 · Chunker is purely character-based

- **Area:** `src/lib/chunk.ts`
- **Problem:** Char-window slicing (size 1000, overlap 150) splits mid-word /
  mid-sentence with no sentence/paragraph awareness; whitespace normalization also
  discards layout that could improve retrieval quality.
- **Fix:** Add sentence/paragraph-aware boundaries. Fine for MVP — quality
  improvement, not a bug.
- **Effort:** M · **Priority:** 🟢 low · **Status:** done

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
- **Effort:** S · **Priority:** 🟢 low · **Status:** done

### TD-15 · Three fonts loaded, only one used

- **Area:** `src/app/layout.tsx`
- **Problem:** Figtree + Geist Sans + Geist Mono are all loaded while `font-sans` is
  the only family visibly used — Geist looks like template residue.
- **Fix:** Drop the unused font imports.
- **Effort:** S · **Priority:** 🟢 low · **Status:** done

### TD-16 · Drop cited-chunk text highlighting — jump to page only

- **Area:** `src/features/documents/components/PdfViewer.tsx` (+ `FilePreview.tsx`),
  `src/features/chat/components/ChatZone.tsx`, `src/features/workspace/components/Container.tsx`,
  `src/features/chat/types.ts`
- **Problem:** Clicking a source chip currently scrolls to the cited page **and**
  paints a translucent box over the matched chunk text on the PDF text layer (RM-1,
  `HIGHLIGHT_MARK_CLASS`). The char-window chunks rarely line up with the text-layer
  spans, so the highlight is fragile/noisy and adds real complexity (`snippets`
  plumbed through `Source` → `onSourceClick` → `handleSourceClick` →
  `selectedHighlights` → `PdfViewer.highlights`).
- **Fix:** Remove the highlighting path — navigate to the page only. Delete
  `HIGHLIGHT_MARK_CLASS`/`MIN_MATCH_LENGTH`, the highlight painting effect and
  `pendingHighlightScrollRef` in `PdfViewer`, the `highlights` prop chain, and the
  `snippets` field on `Source` if nothing else uses it. Keep page-scroll behavior.
- **Effort:** S · **Priority:** 🟡 medium · **Status:** done

### TD-17 · Collapse source chips to one page + a `+N` page picker

- **Area:** `src/features/chat/components/ChatZone.tsx`,
  `src/features/workspace/components/Container.tsx`,
  `src/app/api/chat/route.ts` (sources grouping)
- **Problem:** An assistant answer renders **every** cited (document, page) as its own
  chip (`sources.map(...)`), so a multi-page match dumps the whole list inline and
  clutters the message.
- **Fix:** Show a single primary source chip (first page) and, when the same answer
  cites more pages, a `+N` affordance (N = count of additional pages carrying the same
  info). Clicking `+N` opens a small list/popover to pick which page to jump to; the
  chosen page drives the existing page-navigation callback. Route text through
  `useT()` (see TD-6 — the current `· с.${page}` is a hardcoded-Cyrillic leak).
- **Effort:** M · **Priority:** 🟡 medium · **Status:** done

### TD-18 · Plan not updated after a successful payment

- **Area:** `src/app/api/stripe/webhook/route.ts` (`syncSubscription`),
  `src/features/billing/*`, `prisma/sql/billingSetup.sql`
- **Problem:** After completing Stripe Checkout the user's `profiles.plan` stays on
  its old value (still gated as `free`) instead of flipping to `pro`. The webhook maps
  `checkout.session.completed` / `customer.subscription.*` → `syncSubscription`, which
  updates the profile by `stripe_customer_id` under the service role — so the plan
  isn't reflecting.
- **Likely causes to check:** (a) the webhook isn't reaching the app in dev (no
  `stripe listen` / wrong `STRIPE_WEBHOOK_SECRET`); (b) `stripe_customer_id` was never
  written on the profile at checkout time, so the `.eq("stripe_customer_id", …)` update
  matches zero rows; (c) `planFromSubscriptionStatus` returns a non-`pro` value for the
  live status; (d) the workspace reads a stale plan (no refresh after redirect back).
- **Fix:** Verify the webhook is delivered and the customer id is persisted at checkout,
  confirm the status→plan mapping, and refresh plan state on return from Checkout.
- **Effort:** M · **Priority:** 🔴 high · **Status:** done (code+SQL ready — verify on live Supabase/Stripe)

### TD-19 · Chat token usage not counted

- **Area:** `src/app/api/chat/route.ts` (`onFinish` → `increment_usage`),
  `prisma/sql/billingSetup.sql` (`increment_usage` / `get_usage`)
- **Problem:** After a chat request the usage meter doesn't move — `tokens_used` stays
  flat although the plan gate reads it (`get_usage`) to enforce the token budget. The
  route wires `streamText({ onFinish: ({ totalUsage }) => rpc("increment_usage",
{ p_tokens }) })`, but the increment isn't landing.
- **Likely causes to check:** (a) `onFinish` runs after the response stream closes in a
  serverless request — the function may be torn down before the RPC completes (needs
  `waitUntil`/awaiting); (b) `totalUsage` is `undefined`/zero for this AI SDK version,
  so `p_tokens` is 0; (c) the deployed `increment_usage` signature/name differs from
  the call (silent RPC failure — the result isn't checked); (d) RLS: `usage` is
  select-only for the owner and writes must go through the SECURITY DEFINER function —
  confirm it's actually SECURITY DEFINER in the live DB.
- **Fix:** Ensure the metering RPC awaits/completes before the request ends, check its
  return for errors, and confirm the deployed function matches the call.
- **Effort:** M · **Priority:** 🔴 high · **Status:** done (code+SQL ready — verify on live Supabase/Stripe)

### TD-20 · `profiles` row is empty after account creation

- **Area:** `prisma/sql/auth_setup.sql` (`handle_new_user` trigger),
  `src/features/auth/actions.ts` (`signUp` metadata)
- **Problem:** A `profiles` row is created for each new `auth.users` row (via the
  `on_auth_user_created` trigger), but after sign-up the row comes out blank — e.g.
  `full_name` (and/or `email`) null — instead of carrying the entered details.
- **Likely causes to check:** (a) `signUp` doesn't pass `full_name` under
  `options.data`, so `raw_user_meta_data ->> 'full_name'` is null; (b) key-name
  mismatch between what the action writes and what the trigger reads; (c) for flows
  where `auth.users.email` isn't populated at insert time (confirm-first / anonymous),
  the copied `email` is null until confirmation. `plan` is set unconditionally, so the
  row exists — only the copied fields are missing.
- **Fix:** Align the sign-up metadata keys with the trigger's `->>` lookups; backfill
  `email` from the auth record on confirm if needed. Verify against a fresh sign-up.
- **Effort:** M · **Priority:** 🔴 high · **Status:** done (code+SQL ready — verify on live Supabase/Stripe)

### TD-21 · Back navigation from the Profile page

- **Area:** profile page / `Header`
- **Problem:** Once on the profile page there's no obvious way back to the workspace —
  the logo isn't a link and there's no back affordance.
- **Fix:** Make the header logo navigate home, and add an explicit back arrow on the
  profile page (label through `useT()`).
- **Effort:** S · **Priority:** 🟢 low · **Status:** done — `Logo` is now a link to `/`
  for signed-in users (guests still end their session); `ProfileContent` has a
  "Back to workspace" link (`Profile.back`) with an `ArrowLeftIcon`.

### TD-22 · Show/hide password toggle on the profile password field

- **Area:** profile "change password" form / `auth`
- **Problem:** The password inputs on the profile change-password form have no way to
  reveal what was typed, so there's no way to catch a typo before submitting.
- **Fix:** Add an eye toggle to the password field(s) that flips `type` between
  `password` and `text`; aria-label through `useT()`.
- **Effort:** S · **Priority:** 🟢 low · **Status:** done — new reusable
  `shared/ui/password-input.tsx` wraps `Input` with an eye toggle (`Auth.showPassword`
  / `Auth.hidePassword`); both `ChangePasswordForm` fields use it.

### TD-24 · Document delete is unresponsive + "Cannot coerce the result to a single JSON object"

- **Area:** `src/features/documents/actions.ts` (`removeDocument`, uses `.single()`),
  delete confirmation modal
- **Problem:** Clicking delete in the modal appears to do nothing; repeated clicks
  queue many delete calls that flood the UI with success/error toasts. The failing
  calls surface `Cannot coerce the result to a single JSON object`, which is PostgREST's
  error when a `.single()` query matches **0 or >1 rows** — so the delete query isn't
  matching the row (likely RLS/scoping or an already-deleted row on the second click).
- **Fix:** Guard the modal's delete button against re-entry (disable + pending state so
  it can't fire multiple times), and fix the query so the delete reliably targets one
  row — replace `.single()` with `.maybeSingle()` (or drop it) where zero rows is a
  valid outcome, and check the returned error before toasting. One toast per action.
- **Effort:** M · **Priority:** 🔴 high · **Status:** done — `removeDocument` uses
  `.maybeSingle()` and treats a missing row as success (idempotent second click); the
  `RemoveDocumentModal` is a controlled dialog that closes on confirm and disables its
  (now destructive) confirm button while a delete is pending.

### TD-25 · "All documents" chat resurrects after deleting all files

- **Area:** `src/features/chat` (per-scope conversation persistence) / workspace
- **Problem:** Conversations are persisted per scope, including the "All documents"
  scope. Deleting every file hides the "All documents" scope in the UI but leaves its
  stored conversation behind; uploading a new file re-shows the scope with the **old**
  messages restored. Deleting all files should also clear the "All documents" thread.
- **Fix:** When the last document is removed, clear/delete the "All documents" scope
  conversation (and any per-document threads) so a fresh upload starts empty.
- **Effort:** M · **Priority:** 🔴 high · **Status:** done — per-document/-folder threads
  already cascade on delete (FK). `handleRemove` now also clears the orphan "all
  documents" thread when the **last** document is removed, and `PreviewContainer` keys
  `ChatZone` on whether any documents exist so it remounts empty at the 0↔1 boundary.

### TD-27 · Errored (unindexed) documents still listed and previewable

- **Area:** documents list / `FilePreview` / preview
- **Problem:** A document that failed ingestion (`status = error`) still shows in the
  file list and can be opened for preview, even though it has no chunks and can't be
  chatted with.
- **Fix:** For `error` docs, suppress the preview and show a clear "couldn't index this
  file" message instead (copy through `useT()`); offer re-ingest (see TD-3) or remove.
- **Effort:** M · **Priority:** 🟡 medium · **Status:** done — `FilePreview` takes the
  document `status` and, for `error` docs, renders a "couldn't index this file" message
  (`Workspace.previewErrored` / `previewErroredBody`) instead of the PDF; the list keeps
  its existing re-index (retry) and remove affordances.

### TD-28 · Profile label "Name" → "Full Name"

- **Area:** profile form
- **Problem:** The profile field is labelled "Name" but holds the user's full name.
- **Fix:** Rename the label (and its i18n key) to "Full Name".
- **Effort:** S · **Priority:** 🟢 low · **Status:** done — `Profile.nameLabel` is now
  "Full Name" (en + ar).

### TD-29 · Replace "Signed in as" with "Hello, {fullName}"

- **Area:** profile / header
- **Problem:** The "Signed in as …" copy is dry for a portfolio piece.
- **Fix:** Swap to a friendlier `Hello, {fullName}` greeting via a parameterized
  `useT()` key (fall back gracefully when `full_name` is empty).
- **Effort:** S · **Priority:** 🟢 low · **Status:** done — `Header` renders
  `Workspace.greeting` ("Hello, {name}") using `full_name`, falling back to the email
  when it's empty; `fullName` is threaded through both layouts. Old `signedInAs` key
  removed (en + ar).

### TD-31 · Delete-file icon not discoverable (mobile + desktop)

- **Area:** documents list UI
- **Problem:** The delete-file action icon is hard/impossible to see on desktop and
  essentially invisible on mobile — users can't tell a file is deletable.
- **Fix:** Make the delete affordance visible and reachable on touch (don't rely on
  hover-reveal on mobile); ensure adequate contrast/hit-area on both.
- **Effort:** S · **Priority:** 🟡 medium · **Status:** done — the delete affordance in
  `DocumentListItem` is now always visible (dropped the `opacity-0 group-hover` reveal),
  uses a clearer trash (`DeleteIcon`) at higher contrast (`text-foreground/50`). Note:
  the sibling **move-to-folder** icon still uses the hover-reveal pattern (out of scope
  for this item).

### TD-32 · Cross-device session invalidation / empty file list

- **Area:** auth session (`@supabase/ssr`) / documents list sync
- **Problem:** Signed in on laptop + phone simultaneously: uploading a file on the phone
  breaks the laptop session (forces a re-login); uploading on the laptop and refreshing
  the phone yields an empty file list. Suggests session/token handling that doesn't
  tolerate concurrent devices, plus a documents fetch that fails silently to empty.
- **Fix:** Investigate session refresh/cookie handling for concurrent sessions and make
  the documents list surface fetch errors instead of rendering empty. Reproduce with two
  devices before/after.
- **Effort:** M · **Priority:** 🔴 high · **Status:** in-progress — the _silent-empty_
  half is done: `WorkspaceContent` now passes a `documentsLoadError` flag when the
  documents query errors, and `UploadZone` shows an error state with a Retry (refresh)
  button instead of the "No documents yet" empty state. The **concurrent-device session
  invalidation** half is not yet fixed — it needs a two-device reproduction and likely
  Supabase auth config (refresh-token rotation / reuse-detection) rather than app code.
