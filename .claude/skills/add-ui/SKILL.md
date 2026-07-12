---
name: add-ui
description: Add or modify UI (components, pages, forms, modals). Use when creating any React component or page so it lands in the right layer with the project's conventions.
---

# Adding UI

## Pick the right layer

Top → bottom; a layer imports only from layers below it:

| Layer | Path | What goes here |
| --- | --- | --- |
| Routes | `src/app/` | `page.tsx` / `layout.tsx` / route handlers only — keep thin, delegate to a container |
| Containers | `src/containers/<Page>/` | Page-level composition, data wiring (e.g. `Workspace/Container.tsx`) |
| Components | `src/components/<domain>/` | Feature components; domains: `auth`, `workspace`, `general`; modals in `<domain>/modals/` |
| Elements | `src/elements/` | shadcn/ui primitives on **Base UI** (button, dialog, form, input, label, tooltip) |
| Layouts | `src/layouts/` | Page shells (`AuthLayout`, `WorkspaceLayout`) |

Need a new primitive? Add it via shadcn (Base UI variant) into `src/elements/` — show the owner the command (`pnpm dlx shadcn@latest add <name>`) rather than hand-rolling a primitive. Never install another UI library.

## Conventions

- Named exports; re-export through the folder's barrel `index.ts`.
- Server components by default; `"use client"` only when the component needs state/effects/browser APIs.
- Every user-facing string goes through i18n — see the `i18n-text` skill. No hardcoded English text in JSX.
- Icons: import from `@/assets/icons` (HugeIcons re-exports), not directly from the icon package.
- Styling: Tailwind classes merged with `cn(...)` from `src/lib/utils.ts`; variants via `class-variance-authority` (see `src/elements/button.tsx` for the pattern).
- Forms: `react-hook-form` + `zod` resolver, schema in `src/lib/validators.ts`, fields via `src/elements/form.tsx` (see `src/containers/SignIn/SignInForm.tsx` for the pattern).
- Mutations call server actions from `src/actions/`; client-side fetching/caching uses TanStack Query.
- Formatting is Prettier-enforced: tabs, printWidth 100, double quotes — run `pnpm format` if unsure.
