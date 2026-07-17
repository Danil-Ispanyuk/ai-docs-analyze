---
name: i18n-text
description: Add or change user-facing text. Use whenever UI copy, labels, errors, placeholders, or aria-labels are added or edited — all strings go through next-intl, never hardcoded.
---

# User-facing text (next-intl)

All copy lives in `src/shared/config/i18n/messages/en.json`, grouped by feature namespace (`auth`, `workspace`, ...). Locale is cookie-based (`NEXT_LOCALE`), no URL routing.

## Workflow

1. Add the key to `src/shared/config/i18n/messages/en.json` under the right namespace. Reuse an existing key if the same copy already exists.
2. Read it with the project's single hook — full key, no namespace argument:

   ```tsx
   import { useT } from "@/shared/config/i18n";

   const t = useT();
   t("workspace.previewError");
   ```

   Works in both Server and Client Components. Keys are type-checked via `src/global.ts` — a typo in the key is a TS error, and `tsc`/ESLint will surface missing keys.

3. Dynamic values use ICU placeholders: `"greeting": "Hello, {name}"` → `t("auth.greeting", { name })`.

## Rules

- No hardcoded user-visible strings in JSX/TSX — including `aria-label`, `alt`, placeholders, and error messages returned by server actions that end up on screen.
- **Keys never start with a capital letter** — namespaces and all nested keys are camelCase (`auth`, `workspace.previewError`), never PascalCase (`Auth`, `Workspace.PreviewError`).
- Don't create a second translation hook or import `useTranslations` directly; `useT` from `@/shared/config/i18n` is the single entry point.
- `en` and `ar` exist today. A new language = add the code to `locales` in `src/shared/config/i18n/config.ts` + create `messages/<code>.json` with the same shape — don't build locale switchers or URL routing unless asked.
