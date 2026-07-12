import messages from "@/shared/config/i18n/messages/en.json";
import type { Locale } from "@/shared/config/i18n/config";

// Makes next-intl type-safe: namespaces in useTranslations(...) and keys in
// t(...) are now autocompleted and checked against en.json (the source locale).
declare module "next-intl" {
	interface AppConfig {
		Locale: Locale;
		Messages: typeof messages;
	}
}
