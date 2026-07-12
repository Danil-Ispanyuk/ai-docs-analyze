import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, locales, LOCALE_COOKIE, type Locale } from "./config";

export default getRequestConfig(async () => {
	const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value as Locale | undefined;

	const locale = cookieLocale && locales.includes(cookieLocale) ? cookieLocale : defaultLocale;

	return {
		locale,
		messages: (await import(`./messages/${locale}.json`)).default,
	};
});
