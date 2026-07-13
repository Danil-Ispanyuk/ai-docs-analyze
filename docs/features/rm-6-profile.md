# RM-6 · Profile (account & billing self-service)

## What it's for

A signed-in user needs one place to manage their account without contacting
support. The **Profile** page (`/profile`) lets a registered user:

- **Change their password** — re-authenticating with the current password first.
- **See their plan** and, when subscribed, the current renewal date.
- **See their payment history** — the Stripe invoices billed to them.
- **Cancel their Pro subscription** — kept active until the end of the paid
  period, then it reverts to Free.

Guests (anonymous sessions) have no password or subscription, so the route
redirects them to `/save-account`; signed-out visitors go to `/sign-in`.

## How it was implemented

**Route + guards.** `src/app/profile/page.tsx` is a server component. It loads
the user via `getCurrentUser()`, redirects unauthenticated → `/sign-in` and
anonymous → `/save-account`, then fetches a `BillingOverview` and renders it in
`ProfileLayout` (the shared `Header` + a scrollable `<main>`).

**Billing overview (read).** `getBillingOverview(userId)` in
`src/features/profile/service.ts` reads the user's `profiles` row under RLS
(plan, `subscription_status`, `stripe_customer_id`, `stripe_subscription_id`).
When a Stripe customer exists it lists their last 12 invoices; when a
subscription exists it retrieves it to read `cancel_at_period_end` and the
current period end (renewal date). Stripe is the source of truth for payments;
we don't mirror invoices into our DB.

**Password change (write).** `changePassword` (server action) verifies the
current password with `signInWithPassword` before calling
`supabase.auth.updateUser({ password })`. The Zod schema
(`changePasswordSchema`) enforces an 8-char minimum and that the new password
differs from the current one.

**Cancellation (write).** `cancelSubscription` (server action) calls
`stripe.subscriptions.update(id, { cancel_at_period_end: true })`. It does **not**
flip `profiles.plan` itself — Stripe emits `customer.subscription.updated`, and
the existing `/api/stripe/webhook` (RM-3) syncs status. The user keeps Pro until
Stripe finally emits `customer.subscription.deleted` at period end, which the
webhook maps to `free`. This mirrors the standard "cancel but keep what you
paid for" flow. The page calls `router.refresh()` after cancelling so the
scheduled-cancellation note appears.

All user-facing copy lives under the `Profile` namespace in
`messages/en.json`; the header gained a `Workspace.profile` link (non-guests
only).

## Components / queries / hooks

| File                                                           | Role                                                           |
| -------------------------------------------------------------- | -------------------------------------------------------------- |
| `src/app/profile/page.tsx`                                     | Route: guards + data load + composition                        |
| `src/layouts/ProfileLayout.tsx`                                | Header + scrollable main shell                                 |
| `src/features/profile/service.ts`                              | `getBillingOverview`, `BillingOverview`/`InvoiceSummary` types |
| `src/features/profile/actions.ts`                              | `changePassword`, `cancelSubscription` server actions          |
| `src/features/profile/validators.ts`                           | `changePasswordSchema` / `ChangePasswordInput`                 |
| `src/features/profile/components/ProfileContent.tsx`           | Server: account + plan + payments cards                        |
| `src/features/profile/components/ChangePasswordForm.tsx`       | Client: password form (toast + reset)                          |
| `src/features/profile/components/PaymentHistory.tsx`           | Server: invoice list (locale-formatted)                        |
| `src/features/profile/components/CancelSubscriptionButton.tsx` | Client: confirm dialog + cancel action                         |
| `src/shared/components/Header.tsx`                             | Added `/profile` link for signed-in users                      |
| `messages/en.json`                                             | `Profile` namespace + `Workspace.profile`                      |

**External:** Stripe API (`invoices.list`, `subscriptions.retrieve`,
`subscriptions.update`) via the `src/features/billing/stripe.ts` seam;
`supabase.auth.signInWithPassword` / `updateUser` for the password change.
Reuses `UpgradeButton` (RM-3) for the Free → Pro CTA.
