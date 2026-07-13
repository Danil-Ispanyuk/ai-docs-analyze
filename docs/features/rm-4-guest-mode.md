# RM-4 · Presentation / guest (demo) mode

**Status:** done (core) · **Effort:** L · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-4

A zero-signup "try it" path: logged-out visitors land on a public page, start a **guest
session** via Supabase anonymous sign-in, and use the real product under the strict guest plan.
Guest data auto-expires. Built on top of RM-3's plans/limits.

---

## 1. What it's for

Before this, `middleware` redirected every unauthenticated request to `/sign-in` — an Upwork
visitor hit a wall. RM-4 opens the front door:

- `/` is now a **public landing** (HR-onboarding themed) for logged-out visitors, with a
  **"Try it now"** CTA.
- "Try it" starts a **Supabase anonymous session** — a real `auth.users` row with a `uid`, so
  RLS, upload, ingestion and chat all work unchanged.
- The guest gets the **strictest plan** (from RM-3): 1 file ≤ 1 MB, ~50k tokens, ~15 requests.
  The trigger assigns `plan = "guest"` automatically for anonymous users.
- Guest accounts (and their documents/chunks/files) are **auto-deleted after 24 h**, so the
  demo doesn't accumulate junk.
- Signed-in users (including guests) get the workspace; the header shows **"Guest session"**
  instead of an empty "Signed in as …" for anonymous users, plus a **"Save account"** CTA.
- A guest can **convert to a permanent account** (`/save-account`) — email + password attached
  to the same user, so their uploaded documents are kept; this also lifts them to the free plan.
- Logging out returns everyone to the public landing `/`.

---

## 2. How it was implemented

### 2.1 Phase A — guest session + open the door

- **Anonymous sign-in** — `signInAnonymously` server action
  ([../../src/actions/auth.ts](../../src/actions/auth.ts)): `supabase.auth.signInAnonymously()`
  then `revalidatePath` + `redirect("/")`. The new `is_anonymous` user triggers
  `handle_new_user`, which sets `plan = "guest"` (RM-3), so all limits apply with **no new
  enforcement code** — the guest reuses the same upload/ingest/chat paths.
- **Open `/`** — [../../src/lib/supabase/middleware.ts](../../src/lib/supabase/middleware.ts):
  the guard now treats `/` as public (`pathname === "/"`, matched exactly — `startsWith("/")`
  would make everything public). Other routes stay guarded.
- **Branch at `/`** — [../../src/containers/Workspace/WorkspaceContent.tsx](../../src/containers/Workspace/WorkspaceContent.tsx)
  (`HomeContent`) no longer redirects logged-out users; it renders `<LandingContent />` when
  there is no user, the workspace otherwise. `LandingContent` is imported by direct path (not
  the `@/containers` barrel) to avoid a barrel import cycle.
- **Landing** — [../../src/containers/Landing/LandingContent.tsx](../../src/containers/Landing/LandingContent.tsx)
  (server component): hero copy + `<TryItButton />` + sign-in/up links.
  [../../src/components/general/TryItButton.tsx](../../src/components/general/TryItButton.tsx)
  (client) calls the action via `useTransition`; the redirect is the success path.
- **Guest header label** — [../../src/components/general/Header.tsx](../../src/components/general/Header.tsx)
  shows `Workspace.guestSession` when `plan === "guest"` (anonymous users have no email).

### 2.2 Phase C — guest data lifecycle (auto-expiry)

[../../prisma/sql/guestCleanup.sql](../../prisma/sql/guestCleanup.sql): a `pg_cron` job runs
`cleanup_anonymous_users()` hourly. The function (SECURITY DEFINER) deletes anonymous users
older than a 24 h TTL — the `auth.users` delete FK-cascades to profiles/documents/chunks — and
first clears their `storage.objects` rows, matched by the `<user_id>/…` path prefix
(`storage.foldername(name)[1]`), consistent with the storage RLS policies. Re-running the
script is safe (it unschedules any prior job of the same name first).

### 2.3 Guest experience — convert, upgrade, logout

- **Convert to account** — `convertGuestAccount` action ([../../src/actions/auth.ts](../../src/actions/auth.ts))
  checks the user is anonymous, calls `supabase.auth.updateUser({ email, password })` (attaches
  the credentials to the same `uid`, so documents are preserved; Supabase emails a confirmation),
  and sets `profiles.plan = "free"`. The form is `SaveAccountForm`
  ([../../src/containers/SaveAccount/SaveAccountForm.tsx](../../src/containers/SaveAccount/SaveAccountForm.tsx))
  at `/save-account` (in the `(auth)` group for `AuthLayout`; the page redirects non-guests away).
  Validation reuses `convertAccountSchema` (= `signUpSchema.pick({ email, password })`).
- **Upgrade vs Save** — the header shows a "Save account" link for guests and the
  "Upgrade to Pro" button for free users (Pro sees neither): a guest has no account to bill yet,
  so it points them to convert first (#2).
- **Logout** — `signOut` now redirects to `/` (the public landing) instead of `/sign-in` (#3).

### 2.4 Phase B (captcha) — built, then removed by decision

A no-dependency Cloudflare Turnstile integration on guest sign-in was implemented and then
**deliberately removed**: for a low-traffic portfolio project the per-guest RM-3 caps + Supabase
IP rate-limits already bound cost, and captcha only adds friction to the zero-signup demo. The
sign-in action, `TryItButton`, and env were reverted; no captcha code remains. It can be
re-added later if abuse appears.

### 2.5 Decisions & limitations

- **No captcha** (see 2.4). **Requires enabling "Allow anonymous sign-ins"** in the Supabase
  Dashboard (Auth) — without it `signInAnonymously` errors (shown inline under the button).
- **Storage bytes on cleanup**: the cron job removes `storage.objects` rows (app stays
  consistent) but the underlying bytes may linger — the same known trade-off as **TD-11**.
  Negligible for tiny, short-lived guest files; upgrade to a Storage-API Edge Function for
  byte-perfect cleanup.
- **Conversion confirmation**: `updateUser({ email })` sends a confirmation email; the account is
  fully permanent once confirmed (via the existing `/auth/confirm` route). We optimistically set
  `plan = "free"` on submit.
- **Not built (optional per roadmap):** a **pre-seeded demo PDF** — deferred because doing it
  well costs an OpenAI embedding per guest and would either slow "Try it" (synchronous ingest,
  cf. TD-3) or need an async seed path. Guests upload their own small PDF for now.

---

## 3. Components, actions, routes, SQL

### New files

| File                                                                                                         | Role                                                     |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [../../src/containers/Landing/LandingContent.tsx](../../src/containers/Landing/LandingContent.tsx)           | Public landing at `/`.                                   |
| [../../src/components/general/TryItButton.tsx](../../src/components/general/TryItButton.tsx)                 | Guest "Try it" CTA → `signInAnonymously`.                |
| [../../src/containers/SaveAccount/SaveAccountForm.tsx](../../src/containers/SaveAccount/SaveAccountForm.tsx) | Guest → account conversion form.                         |
| [../../src/app/(auth)/save-account/page.tsx](<../../src/app/(auth)/save-account/page.tsx>)                   | `/save-account` route (guest-only, redirects others).    |
| [../../prisma/sql/guestCleanup.sql](../../prisma/sql/guestCleanup.sql)                                       | `pg_cron` TTL cleanup of anonymous users + storage rows. |

### Changed files

| File                                                                                                                                            | Change                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [../../src/actions/auth.ts](../../src/actions/auth.ts)                                                                                          | `signInAnonymously` + `convertGuestAccount` actions; `signOut` now redirects to `/`. |
| [../../src/lib/validators.ts](../../src/lib/validators.ts)                                                                                      | `convertAccountSchema` + type.                                                       |
| [../../src/lib/supabase/middleware.ts](../../src/lib/supabase/middleware.ts)                                                                    | `/` public for logged-out visitors.                                                  |
| [../../src/containers/Workspace/WorkspaceContent.tsx](../../src/containers/Workspace/WorkspaceContent.tsx)                                      | Render landing instead of redirect when no user.                                     |
| [../../src/components/general/Header.tsx](../../src/components/general/Header.tsx)                                                              | "Guest session" label; "Save account" CTA for guests / "Upgrade" for free.           |
| [../../src/containers/index.ts](../../src/containers/index.ts) · [../../src/components/general/index.ts](../../src/components/general/index.ts) | Barrels for the new components.                                                      |
| [../../src/i18n/messages/en.json](../../src/i18n/messages/en.json)                                                                              | `Landing.*`, `Workspace.guestSession`, `Auth.saveAccount*`.                          |

### Reused unchanged (RM-3)

- `plan = "guest"` assignment in `prisma/sql/auth_setup.sql`; guest limits in
  `src/lib/billing.ts`; enforcement in `createDocument` and `/api/chat`.

### External setup (not code)

- Enable **Allow anonymous sign-ins** (Supabase → Authentication).
- Enable **pg_cron** and run `guestCleanup.sql` in the SQL Editor.

### Dependencies

None. (The removed Phase B added none either — Turnstile was loaded via `next/script`.)
