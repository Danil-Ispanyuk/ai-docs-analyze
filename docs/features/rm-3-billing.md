# RM-3 · Billing & plan limits (Stripe test mode)

**Status:** done · **Effort:** L · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-3

Monetization demo for the portfolio: three plans (`guest` / `free` / `pro`), per-plan file
and usage limits enforced before any paid work, and a Stripe **test-mode** Checkout +
webhook that flips a user to Pro. Built in three phases — foundation, enforcement, billing.

---

## 1. What it's for

The app calls OpenAI on every upload (embeddings) and every chat message (embedding +
completion), so unbounded use is real cost/abuse exposure. RM-3 puts a plan behind each user
and meters that cost:

- **Plans & limits** (proposals, tunable in `src/lib/billing.ts`):

  | Plan  | Max file size | Storage | Max files | Token budget / mo | Request cap / mo |
  | ----- | ------------- | ------- | --------- | ----------------- | ---------------- |
  | guest | 1 MB          | 1 MB    | 1         | 50k               | 15               |
  | free  | 5 MB          | 2 GB    | ∞         | 500k              | ∞                |
  | pro   | 50 MB         | 15 GB   | ∞         | 5M                | ∞                |

- **Upload** is rejected (before ingestion) if the file exceeds the plan's size, the user is
  over their file count, or the upload would push them past the plan's **total storage** budget.
- **Chat** returns `429` (before embedding/completion) once the monthly token budget or
  request cap is hit; every completed answer's token usage is metered back.
- An **"Upgrade to Pro"** button in the header (shown to non-Pro users) starts Stripe Checkout;
  paying flips `profiles.plan` to `pro` via the webhook and the limits rise automatically.
- **Limits are surfaced in the UI:** `UploadZone` shows a live **storage meter** (used vs the
  plan's storage budget, with "X left" / "Storage full") plus the per-file size / file-count
  hints (and disables the dropzone at the file or storage cap); `ChatZone`'s header shows a
  usage meter — questions used vs cap for request-capped plans (guest), otherwise the monthly
  token budget. Both use the shared `UsageMeter` component (bar turns amber ≥90 %, red ≥100 %).
  Usage comes from a `get_usage` fetch in `WorkspaceContent`; `formatTokens` renders compact
  budgets (`500k`, `5M`) and `formatStorage` renders storage figures (`2.3 MB`, `2 GB`) — both
  in `lib/billing.ts`.

`guest` exists in the model but is only _assigned_ here (to anonymous users, at sign-up); the
guest **experience** is RM-4.

---

## 2. How it was implemented

Three phases. A and B deliver working plan limits with no payment integration at all; C adds
Stripe on top.

### 2.1 Phase A — plan foundation

- **`profiles.plan`** (`guest | free | pro`, default `free`). The `handle_new_user` trigger in
  [../../prisma/sql/auth_setup.sql](../../prisma/sql/auth_setup.sql) sets it to `guest` for
  anonymous sign-ins (`new.is_anonymous`), `free` otherwise.
- **`usage` table** — one row per user per **calendar month**
  (`period_start = date_trunc('month', now())`), with `tokens_used` / `requests_used`. A new
  month naturally yields a fresh row, which _is_ the reset — no cron needed.
- **Tamper-proof counters.** [../../prisma/sql/billingSetup.sql](../../prisma/sql/billingSetup.sql)
  enables RLS with a **select-only** policy (owner may read their usage) and **no** write
  policy. All writes go through two functions: `get_usage()` (current-period counters, `0/0`
  when absent) and `increment_usage(p_tokens)` — the latter is `SECURITY DEFINER`, so it
  bypasses RLS to upsert the row keyed to `auth.uid()`. A user can read their usage but can
  never reset it.
- **`src/lib/billing.ts`** — the single source of truth for limits: `PLAN_LIMITS` +
  `getPlanLimits(plan)`. This is the "wrapper module per concern" seam; the numbers live here.

### 2.2 Phase B — enforcement

- **Upload** ([../../src/actions/documents.ts](../../src/actions/documents.ts) `createDocument`):
  after auth it reads `profiles.plan`, then, **before inserting/ingesting**:
  - **Max files** — counts the user's documents (RLS-scoped); over the cap → remove the
    just-uploaded Storage object and return an error.
  - **Max file size** — reads the object's size from **Storage metadata** (`storage.list` with
    a `search`), not the spoofable client value; over the limit → remove + error. That same
    trusted byte count is **persisted to `documents.size`** on insert (the column added by the
    `…_document_size` migration), so it can't be forged.
  - **Total storage** — sums the user's existing `documents.size` (RLS-scoped) and rejects if
    `used + this upload > storageLimit` → remove + error.

  The client ([../../src/components/workspace/UploadZone.tsx](../../src/components/workspace/UploadZone.tsx))
  also pre-checks against the plan's file size **and** remaining storage (via
  `getPlanLimits(plan)`, summing `documents[].size`) for instant feedback; the `fileSizeError`
  and `storageError` strings are parameterised with `{size}`. `plan` is threaded
  `WorkspaceContent → PreviewContainer → UploadZone`, and `documents` now carry `size`.

- **Chat** ([../../src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)): after auth it
  reads `plan` + `get_usage()` and, **before** the query embedding / completion, returns `429`
  if `requests_used >= requestCap` or `tokens_used >= tokenBudget`. `streamText`'s `onFinish`
  then calls `increment_usage` with `totalUsage.totalTokens` (+1 request). Embedding tokens are
  not counted (negligible).

### 2.3 Phase C — Stripe billing (test mode)

- **Schema.** `profiles` gained `stripe_customer_id` (unique), `stripe_subscription_id`,
  `subscription_status` — written by the webhook, read to gate.
- **Provider seam** [../../src/lib/stripe.ts](../../src/lib/stripe.ts): the configured `stripe`
  client, `STRIPE_PRICE_ID`, and `planFromSubscriptionStatus()` (active/trialing → `pro`, else
  `free`). Kept thin so it can be repointed at Lemon Squeezy / Paddle if billing ever goes real
  (Stripe has no Ukraine payouts).
- **Checkout** [../../src/actions/billing.ts](../../src/actions/billing.ts) `createCheckoutSession`:
  finds-or-creates the Stripe customer (persisting `stripe_customer_id` on the profile under the
  user's own RLS), creates a `subscription` Checkout session for the Pro price, and returns
  `session.url`. The client redirects the browser there.
- **Webhook** [../../src/app/api/stripe/webhook/route.ts](../../src/app/api/stripe/webhook/route.ts):
  `runtime = "nodejs"`, reads the **raw body** and verifies the signature with
  `constructEventAsync`. On `checkout.session.completed` (retrieves the subscription),
  `customer.subscription.updated`, and `.deleted`, it writes `stripe_subscription_id`,
  `subscription_status`, and the mapped `plan` onto the matching profile — looked up by
  `stripe_customer_id`. Because a webhook has **no user session**, it uses the service-role
  client [../../src/lib/supabase/admin.ts](../../src/lib/supabase/admin.ts), which bypasses RLS
  (the only sanctioned use of that client). Handler errors return `500` so Stripe retries.
- **UI** — [../../src/components/general/UpgradeButton.tsx](../../src/components/general/UpgradeButton.tsx)
  calls the action and redirects; mounted in the header for `plan !== "pro"`.

### 2.4 Migrations — applied via `prisma:deploy`, not `migrate dev`

`prisma migrate dev` **cannot run** in this project: it drift-introspects the live DB and fails
(P4002) on the hand-run cross-schema FKs into `auth.users`. Both RM-3 migrations were therefore
**hand-authored** and applied with `pnpm prisma:deploy` (no shadow DB, no drift check):
`20260712120000_billing_plan_usage` (plan + usage) and `20260712130000_stripe_billing_fields`.
The later storage meter added a third, `20260712140000_document_size` (the `documents.size`
column, `INTEGER NOT NULL DEFAULT 0`), applied the same way.
The `…_document_chunks` migration was also prefixed with `CREATE EXTENSION IF NOT EXISTS vector`
so a from-scratch replay has the `vector` type. The RLS/trigger/function SQL in
`prisma/sql/{auth_setup,billingSetup}.sql` is pasted into the Supabase SQL Editor by hand.

### 2.5 Decisions & limitations

- **Stripe test mode**, single Pro monthly price. Guest metering is monthly like everyone else
  for now; a lifetime guest budget is revisited with RM-4.
- Chat over-limit `429` bodies are **raw English** (surfaced via `useChat` `onError`); mapping
  them to i18n keys / toasts is deferred to TD-6 / RM-5.
- `lib/stripe.ts` instantiates the client at import time, so `STRIPE_SECRET_KEY` must be set
  before `build`/runtime.
- This overlaps **TD-10** (rate limiting): the usage counter is the cost-control mechanism.

---

## 3. Components, actions, queries, types

### New files

| File                                                                                             | Role                                                                                         |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| [../../src/lib/billing.ts](../../src/lib/billing.ts)                                             | `Plan`, `PlanLimits`, `PLAN_LIMITS`, `getPlanLimits()`, `formatTokens()`, `formatStorage()`. |
| [../../src/components/general/UsageMeter.tsx](../../src/components/general/UsageMeter.tsx)       | Shared usage bar (storage + tokens/questions); amber ≥90 %, red ≥100 %.                      |
| `prisma/migrations/20260712140000_document_size/`                                                | Hand-authored migration — `documents.size` column.                                           |
| [../../src/lib/stripe.ts](../../src/lib/stripe.ts)                                               | Stripe client seam + `planFromSubscriptionStatus()`.                                         |
| [../../src/lib/supabase/admin.ts](../../src/lib/supabase/admin.ts)                               | Service-role client — webhook only, bypasses RLS.                                            |
| [../../src/actions/billing.ts](../../src/actions/billing.ts)                                     | `createCheckoutSession` server action.                                                       |
| [../../src/app/api/stripe/webhook/route.ts](../../src/app/api/stripe/webhook/route.ts)           | Signature-verified webhook → syncs subscription to `profiles.plan`.                          |
| [../../src/components/general/UpgradeButton.tsx](../../src/components/general/UpgradeButton.tsx) | Header "Upgrade to Pro" CTA.                                                                 |
| [../../prisma/sql/billingSetup.sql](../../prisma/sql/billingSetup.sql)                           | `usage` FK + RLS + `get_usage()` / `increment_usage()`.                                      |
| `prisma/migrations/20260712120000_billing_plan_usage/` · `…130000_stripe_billing_fields/`        | Hand-authored migrations.                                                                    |

### Changed files

| File                                                                                                                                                                       | Change                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [../../prisma/schema.prisma](../../prisma/schema.prisma)                                                                                                                   | `Profile.plan` + Stripe fields; new `Usage` model; `Document.size`.                                                                                                     |
| [../../prisma/sql/auth_setup.sql](../../prisma/sql/auth_setup.sql)                                                                                                         | Trigger sets `plan` (`guest` for anon).                                                                                                                                 |
| [../../src/actions/documents.ts](../../src/actions/documents.ts)                                                                                                           | Plan gate (max files + file size + **total storage**) in `createDocument`; persists `size` from Storage metadata.                                                       |
| [../../src/app/api/chat/route.ts](../../src/app/api/chat/route.ts)                                                                                                         | Pre-work budget/cap gate (`429`) + `onFinish` metering.                                                                                                                 |
| [../../src/components/workspace/UploadZone.tsx](../../src/components/workspace/UploadZone.tsx)                                                                             | Plan-aware pre-check (size + storage); `plan` prop; renders the storage `UsageMeter`.                                                                                   |
| [../../src/components/workspace/ChatZone.tsx](../../src/components/workspace/ChatZone.tsx)                                                                                 | Token/question usage rendered via the shared `UsageMeter`.                                                                                                              |
| [../../src/lib/documents.ts](../../src/lib/documents.ts)                                                                                                                   | Removed the global `MAX_FILE_SIZE` (now plan-dependent); `DocumentRow.size`.                                                                                            |
| [../../src/containers/Workspace/WorkspaceContent.tsx](../../src/containers/Workspace/WorkspaceContent.tsx) · [Container.tsx](../../src/containers/Workspace/Container.tsx) | Fetch + thread `plan`; select `size`.                                                                                                                                   |
| [../../src/layouts/WorkspaceLayout.tsx](../../src/layouts/WorkspaceLayout.tsx) · [Header.tsx](../../src/components/general/Header.tsx)                                     | `plan` prop → render `UpgradeButton`.                                                                                                                                   |
| [../../src/i18n/messages/en.json](../../src/i18n/messages/en.json)                                                                                                         | `Workspace.upgrade/upgrading/upgradeError`; `fileSizeError` `{size}`; storage/usage meter keys (`storageLabel/Usage/Left/Full/Error`, `tokensLabel`, `questionsLabel`). |
| [../../.env.local.example](../../.env.local.example)                                                                                                                       | `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`.                                                                                 |

### Types

- `Plan = "guest" | "free" | "pro"`;
  `PlanLimits = { maxFileSize, storageLimit, maxFiles, tokenBudget, requestCap }` (`null` = unlimited
  for the nullable ones; `maxFileSize` / `storageLimit` are always set).
- `DocumentRow` gained `size: number` (bytes), selected in `WorkspaceContent` and summed for the meter.

### Queries / RPCs / DB

- `get_usage()` — current-period `(tokens_used, requests_used)` for `auth.uid()` (select-only RLS).
- `increment_usage(p_tokens)` — `SECURITY DEFINER` upsert of the current-period row (+1 request).
- Reads of `profiles.plan` (chat route, upload action, workspace container); webhook writes
  `plan`/Stripe fields via the service-role client.

### External setup (not code)

Stripe test-mode account + Pro price, the four env vars above, and a webhook source — locally
`stripe listen --forward-to localhost:3000/api/stripe/webhook` (which prints
`STRIPE_WEBHOOK_SECRET`). The Stripe **CLI** is a separate binary from the `stripe` npm SDK.

### Dependencies

- **`stripe`** (server SDK, v22) — the one new dependency. No client-side Stripe SDK (redirect
  Checkout).
