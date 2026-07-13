# RM-9 · RTL support (Arabic)

**Status:** done · **Effort:** L · Roadmap: [../ROADMAP.md](../ROADMAP.md) → RM-9

Adds Arabic (`ar`) as a right-to-left locale, a language switcher, `dir="rtl"` handling on
`<html>`, and a layout audit to logical CSS so the whole app mirrors correctly.

---

## 1. What it's for

The app shipped English-only with no way to change language. RM-9 demonstrates RTL
capability to prospective clients in Arabic-speaking markets:

- A compact **language switcher** (English · العربية) in the workspace/profile header and on
  the landing page. Selecting a language persists it and re-renders the app in that language
  and direction.
- Choosing Arabic sets `dir="rtl"` on `<html>`, flips the layout (spacing, alignment,
  positioning) and mirrors directional icons (send arrow, folder chevron).

---

## 2. How it was implemented

### 2.1 Locale config + direction

[../../src/shared/config/i18n/config.ts](../../src/shared/config/i18n/config.ts): `locales`
gained `"ar"`; added `rtlLocales`, `getDirection(locale)` (`"rtl" | "ltr"`), and
`localeLabels` (each language in its own script). The existing cookie-based
`request.ts`/`defaultLocale` machinery already resolves the active locale — no URL routing.

[../../src/app/layout.tsx](../../src/app/layout.tsx): `<html>` now gets
`dir={getDirection(locale)}` alongside `lang`.

### 2.2 Language switcher

- [../../src/shared/config/i18n/actions.ts](../../src/shared/config/i18n/actions.ts) —
  `setLocale(locale)` server action: validates against `locales`, writes the `NEXT_LOCALE`
  cookie (the one `request.ts` reads), and `revalidatePath("/", "layout")` so the tree
  re-renders with the new messages **and** direction.
- [../../src/shared/components/LocaleSwitcher.tsx](../../src/shared/components/LocaleSwitcher.tsx) —
  a `"use client"` segmented control reading the active locale via `useLocale()`; each
  option calls `setLocale` inside a transition. Placed in
  [Header.tsx](../../src/shared/components/Header.tsx) and
  [LandingContent.tsx](../../src/features/landing/components/LandingContent.tsx).

### 2.3 Arabic translations

[../../src/shared/config/i18n/messages/ar.json](../../src/shared/config/i18n/messages/ar.json)
is a full translation mirroring `en.json` **key-for-key** (174 keys, ICU placeholders like
`{email}`/`{size}` preserved). A `Locale.switchLanguage` key was added to both files.

### 2.4 RTL layout audit

Physical Tailwind utilities were converted to logical ones across all components so they
flip with `dir`:

- `ml-*/mr-*` → `ms-*/me-*`, `pl-*/pr-*` → `ps-*/pe-*`,
  `text-left/text-right` → `text-start/text-end`.
- Directional absolute positioning: `left-0` → `start-0`
  ([SourceChips](../../src/features/chat/components/SourceChips.tsx) dropdown), the dialog
  close button `right-4` → `end-4` ([dialog.tsx](../../src/shared/ui/dialog.tsx)). Symmetric
  centering (`left-1/2 -translate-x-1/2`) was left as-is.
- Directional **icons** get `rtl:-scale-x-100`: the send arrow
  ([ChatZone](../../src/features/chat/components/ChatZone.tsx)) and the folder chevron
  ([FolderGroup](../../src/features/folders/components/FolderGroup.tsx)).

Verified with a production build (`pnpm build`) plus the full test suite; the message-key
diff confirms `en`/`ar` are in sync.

---

## 3. Components, config, types

| File                                                                                                                                                                                        | Role                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [src/shared/config/i18n/config.ts](../../src/shared/config/i18n/config.ts)                                                                                                                  | `ar` locale, `rtlLocales`, `getDirection`, `localeLabels`.             |
| [src/shared/config/i18n/actions.ts](../../src/shared/config/i18n/actions.ts)                                                                                                                | `setLocale` server action (cookie + revalidate).                       |
| [src/shared/config/i18n/messages/ar.json](../../src/shared/config/i18n/messages/ar.json)                                                                                                    | Full Arabic translation.                                               |
| [src/shared/components/LocaleSwitcher.tsx](../../src/shared/components/LocaleSwitcher.tsx)                                                                                                  | Language toggle (client).                                              |
| [src/app/layout.tsx](../../src/app/layout.tsx)                                                                                                                                              | `dir` on `<html>`.                                                     |
| [src/shared/components/Header.tsx](../../src/shared/components/Header.tsx) · [src/features/landing/components/LandingContent.tsx](../../src/features/landing/components/LandingContent.tsx) | Switcher placement.                                                    |
| Component `className`s across `src`                                                                                                                                                         | Physical → logical utilities; `rtl:-scale-x-100` on directional icons. |

### Not touched

No new dependencies (reuses `next-intl`). No schema/DB. Only Arabic was added; more RTL
locales just need a `messages/<code>.json` + an entry in `locales`/`rtlLocales`/`localeLabels`.
