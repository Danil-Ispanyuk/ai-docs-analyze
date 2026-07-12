---
name: i18n-text
description: Add or change user-facing text. Use whenever UI copy, labels, errors, placeholders, or aria-labels are added or edited — all strings go through next-intl, never hardcoded.
---

# User-facing text (next-intl)

All copy lives in `src/i18n/messages/en.json`, grouped by feature namespace (`Auth`, `Workspace`, ...). Locale is cookie-based (`NEXT_LOCALE`), no URL routing.

## Workflow

1. Add the key to `src/i18n/messages/en.json` under the right namespace. Reuse an existing key if the same copy already exists.
2. Read it with the project's single hook — full key, no namespace argument:

   ```tsx
   import { useT } from "@/i18n";

   const t = useT();
   t("Workspace.previewError");
   ```

   Works in both Server and Client Components. Keys are type-checked via `src/global.ts` — a typo in the key is a TS error, and `tsc`/ESLint will surface missing keys.

3. Dynamic values use ICU placeholders: `"greeting": "Hello, {name}"` → `t("Auth.greeting", { name })`.

## Rules

- No hardcoded user-visible strings in JSX/TSX — including `aria-label`, `alt`, placeholders, and error messages returned by server actions that end up on screen.
- Don't create a second translation hook or import `useTranslations` directly; `useT` from `@/i18n` is the single entry point.
- Only `en` exists today. A new language = add the code to `locales` in `src/i18n/config.ts` + create `messages/<code>.json` with the same shape — don't build locale switchers or URL routing unless asked.
