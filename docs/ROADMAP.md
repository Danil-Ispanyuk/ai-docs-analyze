# Roadmap — New Functionality

Planned features and enhancements **beyond the current MVP**. Cleanups of existing
code live in [TECH_DEBT.md](./TECH_DEBT.md).

> Planning-only doc. Everything here is at research / proposal stage unless marked
> otherwise — nothing is built until picked up as an explicit task. The scope
> guardrails in `CLAUDE.md → Scope` still apply: flag before pulling any of these in.

## Legend

- **Status** — `idea` · `researched` · `planned` · `in-progress` · `done`
- **Effort** — S · M · L

## Features

### RM-1 · PDF viewer — highlight the cited chunk (react-pdf migration, step 2)

- **What:** After jumping to a cited page, highlight the exact cited chunk(s) on the
  text layer. Step 1 (react-pdf render + jump-to-page) is done.
- **Why:** Closes the citation loop — the user sees _where_ on the page the answer came
  from, not just which page.
- **Decided:**
  - Highlight **all retrieved chunks** on the cited page (not just top-1).
  - Highlight the **full chunk text** (not a snippet).
  - Highlight **persists until the next citation** is clicked.
  - Matching is **best-effort** (normalized-whitespace compare); if no confident match,
    fall back to a plain page-jump. No coordinate/bbox storage.
- **Scope / dependency:**
  - Carry chunk `content` per source in `Source` (`src/lib/chat.ts`); today `route.ts`
    dedupes by `(document, page)` and drops `content`. Group by page so a page's sources
    carry all its retrieved chunk texts. Touches the RAG/chat pipeline, not just the
    viewer — that's why it was split out.
  - Render via react-pdf `<Page customTextRenderer>` wrapping matches in `<mark>`
    (highlight token); scroll the first highlighted span into view (center), fall back
    to page top; clear highlight on document switch.
  - Optional: extract `Spinner` (TD-1) while in `PdfViewer`.
- **Effort:** M · **Status:** done

### RM-2 · Password reset

- **What:** `/forgot-password` (calls `resetPasswordForEmail`) + `/reset-password`
  (calls `updateUser({ password })`) pages, a "Forgot password?" link on sign-in,
  zod schemas + i18n strings.
- **Why:** Table-stakes auth for a credible demo.
- **Already in place:** `/auth/confirm` already runs `verifyOtp` for any type incl.
  `recovery` — point the recovery email at
  `/auth/confirm?...&type=recovery&next=/reset-password`.
- **Decided:**
  - **Scope = recovery only** (forgot → reset); no in-app "change password" in settings.
  - `/forgot-password` shows a **generic message** ("if an account exists, we've sent a
    link") — no email enumeration.
  - After a successful reset, go **straight into the app** (`/`) with a success toast —
    the recovery session is already active.
  - Expired / invalid recovery link → redirect to **`/forgot-password`** with a
    "request a new link" message (not `/sign-in`).
  - Password rules **reuse `signUpSchema`** (`validators.ts`).
  - SMTP = **Brevo**.
- **Scope / dependency:**
  - Add `/forgot-password` to `PUBLIC_PREFIXES` in `lib/supabase/middleware.ts`.
  - **SMTP (the real blocker):** Supabase built-in mail is rate-limited to team
    addresses, not for real users. Configure Brevo SMTP in Supabase Dashboard → Auth →
    SMTP (verified sender domain, SPF/DKIM in DNS), then raise the auth email rate
    limits. No npm package — Supabase talks SMTP directly.
  - Success toasts via RM-5 ("reset email sent", "password changed").
- **Effort:** M · **Status:** done

### RM-3 · Billing & plan limits (Stripe test mode)

- **What:** Stripe Checkout (hosted) in **test mode** + a `/api/stripe/webhook` route
  that syncs subscription status → `profiles.plan`. Package: `stripe` (server SDK); no
  client SDK needed for redirect Checkout.
- **Why:** Demonstrates monetization for the portfolio without a real payout account.
- **Provider note:** Keep it behind a thin billing module so it's swappable — if this
  ever goes real, Stripe has no Ukraine payout support → Lemon Squeezy / Paddle
  (merchant-of-record, handle VAT, support UA payouts).

**Limit model** — gate on **file size** + a **token budget** (tokens map directly to
OpenAI cost: embeddings + gpt-4o-mini). File size bounds one-time ingestion cost; the
token budget meters recurring chat cost.

| Plan                  | File size | Files | Token budget           | Requests     | Auto-expiry    |
| --------------------- | --------- | ----- | ---------------------- | ------------ | -------------- |
| **Guest** (anon)      | ≤ 1 MB    | 1     | small, lifetime (~50k) | capped (~15) | yes — see RM-4 |
| **Free** (registered) | ≤ 5 MB    | —     | monthly (~500k)        | —            | no             |
| **Pro**               | no limit* | —     | large monthly (~5M)    | —            | no             |

<sub>*Numbers are proposals to tune. gpt-4o-mini is cheap (~$0.15/1M in, ~$0.60/1M out),
so budgets can be generous; "no limit" is practically bounded by the token budget.</sub>

- **Schema / code implications:**
  - `profiles.plan` — `guest | free | pro` (default `free`; anon users → `guest`).
  - **Usage counter** — chat isn't persisted, so add a `usage` table
    (`user_id, period_start, tokens_used, requests_used`) or counter columns; capture
    OpenAI `usage` (prompt + completion tokens) from `streamText`'s `onFinish` in
    `/api/chat` and increment. Ties into **TD-10** (rate limiting).
  - Make `MAX_FILE_SIZE` plan-dependent (currently a global 25 MB in `lib/documents.ts`).
  - Enforce limits in the upload action **and** `/api/chat`, before doing paid work.
- **Effort:** L · **Status:** done · **Decided:** Stripe test mode; gate on file size + token budget

### RM-4 · Presentation / guest (demo) mode

- **What:** Landing page at `/` for logged-out users (instead of the current redirect
  to `/sign-in`) with a "Try it" CTA that starts a guest session via Supabase
  **anonymous sign-in** (`signInAnonymously`). The guest uploads their own small file
  and tests the full flow.
- **Why:** An Upwork visitor hits a wall today (`middleware` redirects everything to
  `/sign-in`). This lets them try the real product with zero signup friction.
- **Scope / dependency:**
  - Guest = the **strictest plan** (shared limits with RM-3): 1 file ≤ 1 MB, small
    token budget, capped requests. Reuses RLS + upload + ingest + chat unchanged, since
    the anon user has a real `uid`. Convertible to a full account later (link
    email/password — data preserved).
  - Allow `/` (+ any `/try` route) for unauthenticated users in `middleware`.
  - **Captcha** (Cloudflare Turnstile / hCaptcha) on anon sign-in to stop spam.
  - **Auto-expiry / cleanup** of guest data — a scheduled job (Supabase **pg_cron** or
    a scheduled Edge Function) deletes anonymous `auth.users` older than a TTL (e.g.
    24h); FK cascade removes their documents/chunks, plus a storage-cleanup step for
    `<user_id>/*` objects.
  - **Rate limiting on `/api/chat` (TD-10) is a prerequisite** — guests cost API calls.
  - Optional: a pre-seeded demo HR-policy PDF so guests can ask immediately without
    uploading.
- **Effort:** L · **Status:** done · **Decided:** anonymous auth + guest plan (own upload)

### RM-5 · Toast notifications (Sonner)

- **What:** A single global toast system for the _outcomes of async actions_ — upload
  success/error, document remove success/error, chat errors (`useChat` `onError`),
  "reset email sent" (RM-2). Field/validation errors stay inline in forms.
- **Why:** Feedback is fragmented today (auth → form root error, upload → local
  `useState`, preview → inline) and there's **no success feedback at all**.
- **Decided:**
  - **Sonner** (`sonner` — new dep; `npx shadcn add sonner`), position **top-right**,
    `richColors`, dark-aware.
  - **Auth errors stay inline** in the form (both field validation _and_ server errors
    like bad credentials) — not toasts.
  - **Ingestion outcome = toast + badge:** the per-doc status badge stays the source of
    truth; a toast fires only on the terminal transition (ready / error).
- **Scope / dependency:**
  - `<Toaster />` in the root layout (`app/layout.tsx`, currently only wraps
    `NextIntlClientProvider`); a thin `lib/toast.ts` wrapper per the project's "wrapper
    module" convention so the provider stays swappable.
  - Migrate the fragmented call sites (UploadZone, FilePreview, remove modal, ChatZone)
    to `toast.success` / `toast.error`; keep RHF field/root validation inline.
  - **i18n:** toast strings go through `useT()`; server-action errors are raw Supabase
    English today — mapping them to i18n keys ties into **TD-6**.
- **Effort:** S–M · **Status:** done

### RM-6 · Delete account + all associated data

- **What:** A "Delete account" flow (confirm dialog) on the profile page that removes
  the user's `auth.users` row and cascades everything they own — profile, documents,
  chunks, chat history, usage — plus their `<user_id>/*` objects in Storage.
- **Why:** Table-stakes account control for a credible demo; also removes lingering
  data (GDPR-friendly).
- **Scope / dependency:**
  - A user can't delete their own `auth.users` row under RLS — needs a privileged
    server path (service role / SECURITY DEFINER), like the guest-cleanup job. Reuse the
    FK-cascade + storage-cleanup pattern from `guestCleanup.sql` / RM-4.
  - Confirm dialog with explicit intent (type-to-confirm or a clear warning); sign the
    user out and route to the landing page after deletion.
- **Effort:** L · **Status:** done · **Decided:** SECURITY DEFINER RPC
  `delete_current_user()` (scoped to `auth.uid()`, like guest cleanup); mandatory confirm
  modal gated by **password re-auth + type-your-email** (no SMTP dependency); best-effort
  Stripe subscription cancel before deletion.

### RM-7 · Folders to group documents and scope chat

- **What:** Organize uploaded documents into folders and run a conversation scoped to a
  folder (in addition to today's single-document / all-documents scopes).
- **Why:** A flat file list doesn't scale; folders let a user keep, say, "Benefits" vs
  "Onboarding" policies separate and ask questions against just one set.
- **Scope / dependency:**
  - New `folders` table (`user_id` + RLS) and a nullable `folder_id` on `documents`.
  - Extend the chat scope mechanism (currently single-doc / all-docs) with a folder
    scope; `match_chunks` filters by the folder's `document_ids`.
  - Conversation persistence is already per-scope — add folder scopes to it.
- **Effort:** L · **Status:** done · **Decided:** one folder per document (nullable
  `folder_id`); deleting a folder **unfiles** its documents (`SET NULL`) and cascades its
  chat thread; scope key on `chat_messages` made orthogonal (`document_id` / `folder_id`);
  `match_chunks` unchanged — the route resolves a folder to its ready `document_ids`;
  collapsible folder groups in the documents panel.

### RM-8 · Guest header sign-in for existing users

- **What:** A "Sign in" affordance in the header while in guest (demo) mode that routes
  an already-registered user to the normal auth flow.
- **Why:** A user who has an account but clicked "Try me" is stuck in a guest session
  with no way to reach sign-in from the header.
- **Scope / dependency:**
  - Builds on RM-4 (guest mode). Copy through `useT()`. Decide whether signing in from a
    guest session should offer to preserve/convert the guest's uploaded data (RM-4 already
    notes anon→account linking) or simply switch accounts.
- **Effort:** S · **Status:** done · **Decided:** switch accounts (existing user); "Save
  account" already covers converting/preserving guest data into a new account.

### RM-9 · RTL support (Hebrew / Arabic)

- **What:** Add a right-to-left locale and direction handling so the app renders
  correctly for Hebrew/Arabic.
- **Why:** Demonstrates RTL capability to prospective clients in those markets.
- **Scope / dependency:**
  - Add an RTL locale (`next-intl` config + `messages/<code>.json`); set `dir="rtl"`
    from the active locale on `<html>`.
  - Audit layout for directional assumptions — prefer logical CSS properties
    (`margin-inline`, `padding-inline`, `start/end`) over `left/right`, and mirror
    directional icons (back arrows, chevrons).
- **Effort:** L · **Status:** done · **Decided:** Arabic (`ar`) as the RTL locale;
  `dir` on `<html>` from `getDirection(locale)`; a header + landing **language switcher**
  (cookie via a `setLocale` server action); layout audited to logical Tailwind utilities
  (`ms/me/ps/pe/text-start/end`) with `rtl:-scale-x-100` on directional icons (send, chevron).
