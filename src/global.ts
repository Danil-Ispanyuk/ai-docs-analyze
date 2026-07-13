import messages from "@/shared/config/i18n/messages/en.json";
import type { Locale } from "@/shared/config/i18n/config";

declare module "next-intl" {
	interface AppConfig {
		Locale: Locale;
		Messages: typeof messages;
	}
}
