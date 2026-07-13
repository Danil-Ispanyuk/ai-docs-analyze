"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { setLocale } from "@/shared/config/i18n/actions";
import { locales, localeLabels, type Locale } from "@/shared/config/i18n/config";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";

export function LocaleSwitcher() {
	const t = useT();
	const active = useLocale() as Locale;
	const [isPending, startTransition] = useTransition();

	const handleSelect = (locale: Locale) => {
		if (locale === active) return;
		startTransition(() => setLocale(locale));
	};

	return (
		<div
			role="group"
			aria-label={t("Locale.switchLanguage")}
			className={cn(
				"flex items-center gap-0.5 rounded-full border border-border p-0.5",
				isPending && "opacity-60",
			)}
		>
			{locales.map((locale) => (
				<button
					key={locale}
					type="button"
					disabled={isPending}
					aria-pressed={locale === active}
					onClick={() => handleSelect(locale)}
					className={cn(
						"rounded-full px-2 py-0.5 text-xs font-medium transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
						locale === active
							? "bg-primary text-primary-foreground"
							: "text-foreground/60 hover:text-foreground",
					)}
				>
					{localeLabels[locale]}
				</button>
			))}
		</div>
	);
}
