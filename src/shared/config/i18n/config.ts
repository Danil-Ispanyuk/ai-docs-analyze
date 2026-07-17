export const locales = ["en", "ar"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

export const LOCALE_COOKIE = "NEXT_LOCALE";

export const rtlLocales: readonly Locale[] = ["ar"];

export type Direction = "ltr" | "rtl";

export function getDirection(locale: Locale): Direction {
	return rtlLocales.includes(locale) ? "rtl" : "ltr";
}

export const localeLabels: Record<Locale, string> = {
	en: "English",
	ar: "العربية",
};
