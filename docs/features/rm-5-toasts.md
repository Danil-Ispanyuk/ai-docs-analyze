# RM-5 · Toast notifications (Sonner)

**Status:** done · **Effort:** S–M · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-5

A single global toast system for the **outcomes of async actions**, replacing feedback that was
scattered across local `useState` error strings (and, for success, missing entirely).

---

## 1. What it's for

Feedback used to be fragmented: upload/remove errors sat in a local `error` state in `UploadZone`,
preview errors were inline, chat errors were **unhandled**, and there was **no success feedback
anywhere**. RM-5 introduces one dark-aware toast host and routes fire-and-forget action outcomes
through it:

- **Upload** → success ("Document added and indexed.") / error toast.
- **Document remove** → success / error toast.
- **Chat** → error toast on `useChat` `onError` (previously silent).
- **Password reset** → "reset link sent" success toast (replacing the inline panel).
- **Upgrade to Pro** → checkout errors surface as a toast.

Deliberately **kept inline** (not toasts): auth form field/root validation errors, and the
`FilePreview` load error — the latter is the state of the preview panel itself, not a transient
action outcome, so a toast + a blank panel would be worse.

---

## 2. How it was implemented

- **Provider + host** — `sonner` (one new dependency). A thin element
  [../../src/elements/sonner.tsx](../../src/elements/sonner.tsx) wraps sonner's `<Toaster>`
  with `theme="system"` (the app has no theme toggle — it styles via `prefers-color-scheme`, so
  this stays light/dark-aware **without** `next-themes`), `position="top-right"`, `richColors`,
  and a close button. It's mounted once in the root layout
  ([../../src/app/layout.tsx](../../src/app/layout.tsx)).
- **Wrapper seam** — [../../src/lib/toast.ts](../../src/lib/toast.ts) exposes `toast.success` /
  `toast.error` over sonner, per the project's "wrapper module per provider" convention, so the
  provider can be swapped without touching call sites. Callers pass already-translated strings.
- **Call-site migration** — `UploadZone` dropped its local `error` state entirely (validation,
  storage, and action outcomes all go through `toast`, and it now emits an upload **success**);
  `ChatZone` added `onError`; `ForgotPasswordForm` swapped its success panel for a toast + form
  reset (its "back to sign in" link already lives in the form footer); `UpgradeButton` dropped
  its inline error span for a toast.

### Ingestion outcome

Ingestion is synchronous inside `createDocument` today, so the upload success/error toast **is**
the terminal ready/error signal — no separate polling is needed. The per-document status badge
remains the source of truth; the toast just announces the transition.

---

## 3. Components, wrappers, call sites

### New files

| File                                                           | Role                                                    |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| [../../src/elements/sonner.tsx](../../src/elements/sonner.tsx) | `<Toaster>` host (theme=system, top-right, richColors). |
| [../../src/lib/toast.ts](../../src/lib/toast.ts)               | `toast.success` / `toast.error` wrapper over sonner.    |

### Changed files

| File                                                                                                                     | Change                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| [../../src/app/layout.tsx](../../src/app/layout.tsx)                                                                     | Mounts `<Toaster />`.                                                           |
| [../../src/components/workspace/UploadZone.tsx](../../src/components/workspace/UploadZone.tsx)                           | Removed local `error` state; all upload/remove feedback via toasts (+ success). |
| [../../src/components/workspace/ChatZone.tsx](../../src/components/workspace/ChatZone.tsx)                               | `useChat` `onError` → toast.                                                    |
| [../../src/containers/ForgotPassword/ForgotPasswordForm.tsx](../../src/containers/ForgotPassword/ForgotPasswordForm.tsx) | "Reset link sent" → toast + reset (panel removed).                              |
| [../../src/components/general/UpgradeButton.tsx](../../src/components/general/UpgradeButton.tsx)                         | Checkout errors → toast.                                                        |
| [../../src/i18n/messages/en.json](../../src/i18n/messages/en.json)                                                       | `Workspace.uploadSuccess/uploadError/removeSuccess/removeError/chatError`.      |

### Decisions & limitations

- Auth field/root validation stays inline; `FilePreview` error stays inline (panel state).
- Server-action error toasts still show **raw English** Supabase/Stripe messages (e.g. a bad
  `STRIPE_PRICE_ID` surfaces `No such price: …`) — mapping these to i18n keys is **TD-6**.

### Dependencies

- **`sonner`** — the one new dependency. No `next-themes` (avoided by `theme="system"`); the
  shadcn "sonner" generator was **not** used (it would pull `next-themes` and overwrite the
  hand-written host).
