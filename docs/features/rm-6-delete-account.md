# RM-6 · Delete account + all associated data

**Status:** done · **Effort:** L · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-6

> **ID note:** the roadmap reuses `RM-6` for two different features. The earlier
> [rm-6-profile.md](./rm-6-profile.md) documents the profile / self-service page; **this**
> doc is the account-deletion flow that the current roadmap entry describes.

A "Danger zone" on the profile page that lets a signed-in user permanently delete their
own account and everything they own — profile, documents, chunks, chat history, usage —
plus their `<user_id>/*` objects in Storage.

---

## 1. What it's for

Account deletion is table-stakes account control (and GDPR-friendly cleanup). A user can't
delete their own `auth.users` row under RLS, so this needs a privileged path — mirroring
the guest-cleanup job (RM-4).

User-visible flow:

- The profile page gains a **Danger zone** section with a destructive **"Delete account"**
  button.
- The button opens a **mandatory confirm modal**. Deletion is gated on **two** things:
  1. **Password re-auth** — the user re-enters their account password.
  2. **Type-to-confirm** — the user types their own email; the confirm button stays disabled
     until it matches (case-insensitive) and a password is present.
- On confirm, everything the user owns is deleted, the session is signed out, and they land
  on the landing page (`/`).

Email-code verification was considered but dropped: Supabase's reauthentication nonce can
only be consumed via `updateUser` (not a delete RPC), and a standalone email OTP would add
the same SMTP dependency as RM-2. Password re-auth proves identity with no email dependency.

---

## 2. How it was implemented

### 2.1 Privileged deletion — a self-scoped SECURITY DEFINER RPC

[../../prisma/sql/accountDeletion.sql](../../prisma/sql/accountDeletion.sql) adds
`public.delete_current_user()`, patterned on `cleanup_anonymous_users()` in
`guestCleanup.sql` but scoped to the **caller** instead of a TTL:

- It never takes a user id — it always reads `auth.uid()`, so a caller can only ever delete
  their **own** account. It raises if there is no authenticated user.
- It clears the caller's `storage.objects` first (no FK cascade from `auth.users` to
  storage), then `delete from auth.users where id = auth.uid()`.
- Deleting the auth row **FK-cascades** to every user table — `profiles`, `documents`,
  `chunks`, `chat_messages`, `chat_rate_events`, `usage` (all wired with
  `on delete cascade` in their setup SQL).
- `SECURITY DEFINER` so it may touch the `auth`/`storage` schemas; `execute` is granted to
  `authenticated` only.
- Same lingering-bytes trade-off as guest cleanup: storage **rows** go, but the underlying
  object bytes may linger in the backend (guest/portfolio-scale, negligible).

This is a function, not schema, so there is **no Prisma migration** — it is pasted into the
Supabase SQL Editor by hand, like the other `prisma/sql/*` scripts.

### 2.2 Server action

`deleteAccount` in [../../src/features/profile/actions.ts](../../src/features/profile/actions.ts),
following the existing `{ error?, message? }` contract:

1. Validate `{ password }` with `deleteAccountSchema`.
2. `getCurrentUser`; bail if unauthenticated / no email.
3. **Re-auth:** `supabase.auth.signInWithPassword({ email, password })` — wrong password
   returns `Profile.deletePasswordIncorrect` (same technique as `changePassword`).
4. **Best-effort Stripe cancel:** if `profiles.stripe_subscription_id` is set,
   `stripe.subscriptions.cancel(...)` so deletion doesn't leave a dangling, still-billing
   subscription. Wrapped in try/catch — a failure logs and does **not** block deletion.
5. `supabase.rpc("delete_current_user")` — the privileged cascade.
6. `supabase.auth.signOut()`, `revalidatePath("/", "layout")`, `redirect("/")`.

`redirect` runs last (outside try/catch) so its `NEXT_REDIRECT` isn't swallowed.

### 2.3 UI

- [../../src/features/profile/components/DeleteAccountButton.tsx](../../src/features/profile/components/DeleteAccountButton.tsx) —
  a `"use client"` `Dialog` (same primitive as `CancelSubscriptionButton`) with a password
  input and a type-your-email input. `canDelete` gates the destructive confirm button
  (password present **and** email matches); the button also shows a pending spinner and is
  disabled while the transition runs, so it can't fire twice. On success the action
  redirects, so only an `error` result is handled — via `toast.error`.
- [../../src/features/profile/components/ProfileContent.tsx](../../src/features/profile/components/ProfileContent.tsx) —
  a new **Danger zone** `<section>` (destructive-tinted border) at the bottom, rendering
  `<DeleteAccountButton email={email} />`.
- The profile page already redirects anonymous users to `/save-account`, so this UI only
  ever renders for a registered user who has a password.

---

## 3. Components, routes, actions, types

| File                                                                                                                           | Role                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| [../../prisma/sql/accountDeletion.sql](../../prisma/sql/accountDeletion.sql)                                                   | `delete_current_user()` SECURITY DEFINER RPC (self-scoped cascade + storage clear); paste into Supabase SQL Editor.                   |
| [../../src/features/profile/actions.ts](../../src/features/profile/actions.ts)                                                 | `deleteAccount` action — re-auth, best-effort Stripe cancel, RPC, sign out, redirect.                                                 |
| [../../src/features/profile/validators.ts](../../src/features/profile/validators.ts)                                           | `deleteAccountSchema` = `{ password }` + `DeleteAccountInput`.                                                                        |
| [../../src/features/profile/components/DeleteAccountButton.tsx](../../src/features/profile/components/DeleteAccountButton.tsx) | Confirm modal (password + type-your-email), pending guard.                                                                            |
| [../../src/features/profile/components/ProfileContent.tsx](../../src/features/profile/components/ProfileContent.tsx)           | Danger zone section.                                                                                                                  |
| [../../src/features/profile/components/index.ts](../../src/features/profile/components/index.ts)                               | Barrel export for `DeleteAccountButton`.                                                                                              |
| [../../src/shared/config/i18n/messages/en.json](../../src/shared/config/i18n/messages/en.json)                                 | `Profile.dangerZoneTitle`, `deleteAccount*`, `deleteModal*`, `deletePassword*`, `deleteConfirmLabel`, `keepAccount`, `confirmDelete`. |

### Not touched

No new dependencies. No Prisma migration (RPC only). No schema/table changes — relies on
the existing `on delete cascade` FKs already in the setup SQL.
