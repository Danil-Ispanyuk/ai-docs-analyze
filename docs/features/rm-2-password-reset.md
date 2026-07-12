# RM-2 · Password reset

**Status:** done · **Effort:** M · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-2

A self-service "forgot password" → "set a new password" flow, built entirely on Supabase
Auth's recovery email. Scope is **recovery only** — there is no in-app "change password"
screen in settings.

---

## 1. What it's for

Before this, a user who forgot their password was stuck — the only auth flows were
sign-in and sign-up. RM-2 adds the table-stakes recovery path expected of any credible app:

- A **"Forgot password?"** link on the sign-in page → `/forgot-password`.
- `/forgot-password` takes an email and triggers a recovery email. It always shows the same
  **generic confirmation** ("if an account exists, we've sent a link") — it never reveals
  whether the email is registered (no account enumeration).
- The email link lands the user on `/reset-password` with an **active recovery session**,
  where they choose a new password.
- On success the user goes **straight into the app** (`/`) — the recovery session is already
  a real session, so no extra sign-in step.
- An **expired / invalid** recovery link sends the user back to `/forgot-password` (with a
  "request a new link" message), not to sign-in.

Password strength for the new password reuses the sign-up rule (min 8 chars), so both places
enforce the same policy.

---

## 2. How it was implemented

### 2.1 Two server actions, same result contract

Two actions were added to [../../src/actions/auth.ts](../../src/actions/auth.ts), following
the existing `{ error?, message? }` result-object convention (never throw across the boundary):

- **`requestPasswordReset`** — re-validates the email with `forgotPasswordSchema`, then calls
  `supabase.auth.resetPasswordForEmail(email, { redirectTo: <origin>/auth/confirm?next=/reset-password })`.
  The result is **deliberately ignored**: a failure (including an unknown email) must be
  indistinguishable from success, so the action always returns the same
  `t("Auth.resetLinkSent")` message. This is the anti-enumeration guarantee.
- **`resetPassword`** — re-validates with `resetPasswordSchema`, calls
  `supabase.auth.updateUser({ password })` (which acts on the current recovery session), then
  `revalidatePath("/", "layout")` + `redirect("/")`.

### 2.2 Reusing the existing OTP confirm route

No new callback route was needed. The recovery email points at the pre-existing
[../../src/app/auth/confirm/route.ts](../../src/app/auth/confirm/route.ts), which already
verifies any email OTP type. It handles **both** Supabase link styles:

- **PKCE `code`** (Supabase default) → `exchangeCodeForSession(code)`.
- **OTP `token_hash` + `type`** → `verifyOtp({ type, token_hash })`.

On success it redirects to `next` (`/reset-password`). On failure it distinguishes recovery
from other confirmations: if `type === "recovery"` **or** `next` starts with `/reset-password`
(the PKCE flow carries no `type`), it redirects to **`/forgot-password?expired=1`** so the
user can request a fresh link — everything else falls back to `/sign-in?error=…`.

### 2.3 Route guarding

[../../src/lib/supabase/middleware.ts](../../src/lib/supabase/middleware.ts): `/forgot-password`
was added to `PUBLIC_PREFIXES` (reachable without a session). `/reset-password` is
**intentionally not** public — it's only ever reached with an active recovery session, so the
normal "authenticated users pass" guard already lets it through, and leaving it out keeps it
inaccessible to anonymous visitors who didn't come from a valid link.

### 2.4 The two forms

Both are `"use client"` containers using `react-hook-form` + `standardSchemaResolver`, matching
the sign-in/up forms:

- **`ForgotPasswordForm`** — takes an `expired?: boolean` prop (from `?expired` search param).
  On submit it calls `requestPasswordReset`; a returned `message` swaps the form for a
  success panel with a "back to sign in" link, while an `error` goes to the RHF `root` error.
  When `expired` is set (and there's no other root error) it shows the
  `Auth.recoveryLinkExpired` alert.
- **`ResetPasswordForm`** — single password field; on submit calls `resetPassword`. There is
  **no success state to render** because the action redirects to `/` on success; only the
  `error` → `root` path is handled.

### 2.5 Decisions & limitations

- **Recovery only** — no authenticated "change my password" flow.
- **Generic confirmation** on `/forgot-password` (no enumeration), by design.
- **SMTP is the real-world blocker, not code.** Supabase's built-in mailer is rate-limited to
  team addresses; delivering to real users requires configuring **Brevo SMTP** in the Supabase
  Dashboard (verified sender, SPF/DKIM) and raising the auth email rate limits. This is
  dashboard/DNS config, not part of the repo — there is no SMTP package.
- Validator error strings are still plain English (see the note in `validators.ts`); localising
  them is deferred until a second locale exists.

---

## 3. Components, routes, actions, types

### New / changed files

| File | Role |
|---|---|
| [../../src/actions/auth.ts](../../src/actions/auth.ts) | `requestPasswordReset`, `resetPassword` server actions (+ existing `signIn`/`signUp`/`signOut`). |
| [../../src/lib/validators.ts](../../src/lib/validators.ts) | `forgotPasswordSchema`, `resetPasswordSchema` (= `signUpSchema.pick({ password })`) + inferred types. |
| [../../src/lib/supabase/middleware.ts](../../src/lib/supabase/middleware.ts) | `/forgot-password` added to `PUBLIC_PREFIXES`. |
| [../../src/app/auth/confirm/route.ts](../../src/app/auth/confirm/route.ts) | Recovery-aware redirect on failure (`/forgot-password?expired=1`); already handled OTP + PKCE. |
| [../../src/app/(auth)/forgot-password/page.tsx](../../src/app/(auth)/forgot-password/page.tsx) | Thin route → `ForgotPasswordForm`, reads `?expired`. |
| [../../src/app/(auth)/reset-password/page.tsx](../../src/app/(auth)/reset-password/page.tsx) | Thin route → `ResetPasswordForm`. |
| [../../src/containers/ForgotPassword/ForgotPasswordForm.tsx](../../src/containers/ForgotPassword/ForgotPasswordForm.tsx) | Email form; generic success panel; `expired` alert. |
| [../../src/containers/ResetPassword/ResetPasswordForm.tsx](../../src/containers/ResetPassword/ResetPasswordForm.tsx) | New-password form; redirect-on-success. |
| [../../src/containers/index.ts](../../src/containers/index.ts) | Barrel exports for both forms. |
| [../../src/i18n/messages/en.json](../../src/i18n/messages/en.json) | `Auth.*` recovery strings (`forgotPassword`, `sendResetLink`, `resetLinkSent`, `recoveryLinkExpired`, `resetPasswordDescription`, `newPasswordLabel`, …). |

### Types

- `ForgotPasswordInput` = `{ email }`, `ResetPasswordInput` = `{ password }` (both `z.infer`).
- `AuthResult` = `{ error?: string; message?: string }` — shared result shape for all auth actions.

### Server / auth calls

- `supabase.auth.resetPasswordForEmail(email, { redirectTo })` — sends the recovery email.
- `supabase.auth.updateUser({ password })` — sets the new password under the recovery session.
- `supabase.auth.exchangeCodeForSession(code)` / `verifyOtp({ type, token_hash })` — in the
  confirm route.

### Not touched

No new dependencies. No database / schema / RLS changes (recovery is pure Supabase Auth). No
new callback route — reused `/auth/confirm`.
