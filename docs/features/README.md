# Features — implementation docs

Detailed, per-feature documentation for functionality delivered from
[../ROADMAP.md](../ROADMAP.md). One file per feature, named after the feature.

Each feature doc answers, in order:

1. **What it's for** — the problem it solves and the user-visible behaviour.
2. **How it was implemented** — the actual approach taken (data flow, decisions,
   trade-offs), reflecting the shipped code (not the proposal).
3. **Components / queries / hooks** — every file, server action, RPC, hook and type
   that participates, with paths, so the feature can be traced end-to-end.

Docs are written **after** the feature is implemented, so they describe reality.

## Index

| ID   | Feature                                   | Doc                                                | Status |
| ---- | ----------------------------------------- | -------------------------------------------------- | ------ |
| RM-1 | PDF viewer — highlight the cited chunk    | [rm-1-pdf-highlight.md](./rm-1-pdf-highlight.md)   | done   |
| RM-5 | Toast notifications (Sonner)              | [rm-5-toasts.md](./rm-5-toasts.md)                 | done   |
| RM-2 | Password reset                            | [rm-2-password-reset.md](./rm-2-password-reset.md) | done   |
| RM-3 | Billing & plan limits (Stripe test mode)  | [rm-3-billing.md](./rm-3-billing.md)               | done   |
| RM-4 | Presentation / guest (demo) mode          | [rm-4-guest-mode.md](./rm-4-guest-mode.md)         | done   |
| RM-6 | Profile (account & billing self-service)  | [rm-6-profile.md](./rm-6-profile.md)               | done   |
| RM-6 | Delete account + all associated data      | [rm-6-delete-account.md](./rm-6-delete-account.md) | done   |
| RM-7 | Chat history persistence (per scope)      | [rm-7-chat-history.md](./rm-7-chat-history.md)     | done   |
| RM-8 | Guest header sign-in for existing users   | [rm-8-guest-signin.md](./rm-8-guest-signin.md)     | done   |
| RM-7 | Folders to group documents and scope chat | [rm-7-folders.md](./rm-7-folders.md)               | done   |

Delivery order is **by dependency**: RM-1 → RM-5 → RM-2 (uses RM-5 toasts) →
RM-3 → RM-4 (uses RM-3 plans/limits).
