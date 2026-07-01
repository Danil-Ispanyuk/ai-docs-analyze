import type { PropsWithChildren } from "react";
import { useT } from "@/i18n";

export function AuthLayout({ children }: PropsWithChildren) {
	const t = useT();

	return (
		<main className="flex min-h-full flex-1 items-center justify-center p-6">
			<section className="w-full max-w-md space-y-6 rounded-2xl border border-black/10 bg-background p-8 shadow-sm dark:border-white/10">
				<header className="space-y-1 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">{t("General.title")}</h1>
					<p className="text-sm text-foreground/60">{t("Auth.subtitle")}</p>
				</header>

				{children}
			</section>
		</main>
	);
}
