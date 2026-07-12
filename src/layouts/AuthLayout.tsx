import type { PropsWithChildren } from "react";
import Link from "next/link";
import { useT } from "@/shared/config/i18n";
import { Logo } from "@/shared/components";

export function AuthLayout({ children }: PropsWithChildren) {
	const t = useT();

	return (
		<main className="relative flex min-h-full flex-1 flex-col items-center justify-center overflow-hidden p-6 max-md:px-3">
			{/* Brand-tinted ambient background */}
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(50rem_36rem_at_50%_-10%,var(--accent),transparent_70%)]"
			/>

			<Link href="/" className="mb-8">
				<Logo />
			</Link>

			<section className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-background/80 p-8 shadow-lg shadow-primary/5 backdrop-blur">
				<header className="space-y-1 text-center">
					<h1 className="text-2xl font-semibold tracking-tight">{t("Auth.subtitle")}</h1>
				</header>

				{children}
			</section>
		</main>
	);
}
