"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { locales, LOCALE_COOKIE, type Locale } from "./config";

// Persists the chosen UI language in the locale cookie (read by request.ts) and
// revalidates so the tree re-renders with the new messages + direction.
export async function setLocale(locale: Locale): Promise<void> {
	if (!locales.includes(locale)) return;

	(await cookies()).set(LOCALE_COOKIE, locale, {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
	});

	revalidatePath("/", "layout");
}
