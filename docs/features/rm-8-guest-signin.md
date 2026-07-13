# RM-8 · Guest header sign-in for existing users

**Status:** done · **Effort:** S · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-8

A "Sign in" affordance in the header while in guest (demo) mode, so a user who
**already has an account** but clicked "Try it" can reach the normal sign-in flow
instead of being stuck in the anonymous session.

---

## 1. What it's for

Guest mode (RM-4) starts an anonymous Supabase session. The header only offered
**"Save account"** (`/save-account`), which converts the _current_ anonymous user into a
new registered account. A visitor who already has an account had no path: converting
would try to attach their existing email to the anon user, and there was no link to
`/sign-in`.

RM-8 adds a second header button, **"Sign in"**, next to "Save account". The split is
deliberate:

- **Save account** — for a first-time visitor: keep the guest's uploaded documents by
  turning this anonymous session into a real account.
- **Sign in** — for a returning user: sign into their existing account. This is a
  **switch account**, not a merge — the anonymous session is replaced by the real one.
  The orphaned guest data is left to the guest-cleanup TTL job (see RM-4).

Merging guest data into a pre-existing account is intentionally out of scope: Supabase
can't attach an already-registered email to the anon user, so there's nothing to merge
into here.

---

## 2. How it was implemented

### 2.1 Header button

[../../src/shared/components/Header.tsx](../../src/shared/components/Header.tsx): in the
`isGuest` branch, the single "Save account" button became a fragment with a **ghost**
`"Sign in"` link (`/sign-in`) before the primary "Save account" button. The label reuses
the existing `Auth.signIn` i18n key — no new string was added.

### 2.2 Middleware — let anonymous users reach the auth pages

[../../src/shared/config/supabase/middleware.ts](../../src/shared/config/supabase/middleware.ts)
guards auth pages with `if (user && isAuthPage) redirect("/")`. Because a guest **is** a
`user` (anonymous), a plain link to `/sign-in` would have bounced straight back to `/`.
The guard was narrowed to skip anonymous users:

```ts
if (user && !user.is_anonymous && isAuthPage) { … redirect("/") }
```

Registered users are still redirected away from `/sign-in` and `/sign-up`; guests now
pass through. Signing in with existing credentials via the normal `signIn` action
(`supabase.auth.signInWithPassword`) replaces the anonymous session with the real one.

### 2.3 Decisions & limitations

- **Switch account, not merge** — guest documents are not carried into an existing
  account; they expire with the guest-cleanup TTL.
- **No new i18n key, no new dependency, no schema change** — reuses `Auth.signIn` and the
  existing `signIn` action / `/sign-in` route.

---

## 3. Components, routes, actions, types

### Changed files

| File                                                                                             | Role                                                                             |
| ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| [../../src/shared/components/Header.tsx](../../src/shared/components/Header.tsx)                 | Adds the ghost "Sign in" link in the guest branch alongside "Save account".      |
| [../../src/shared/config/supabase/middleware.ts](../../src/shared/config/supabase/middleware.ts) | Auth-page guard narrowed to `!user.is_anonymous` so guests can reach `/sign-in`. |

### Reused (not changed)

- `Auth.signIn` string in
  [../../src/shared/config/i18n/messages/en.json](../../src/shared/config/i18n/messages/en.json).
- `signIn` server action + `/sign-in` route
  ([../../src/features/auth/actions.ts](../../src/features/auth/actions.ts)) — sign-in
  replaces the anonymous session.
