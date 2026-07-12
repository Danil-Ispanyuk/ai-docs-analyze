// Single source of truth for locales. Add a code here + a messages/<code>.json
// file to introduce a new language.
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Cookie that holds the active locale (no URL routing in this setup).
export const LOCALE_COOKIE = "NEXT_LOCALE";
