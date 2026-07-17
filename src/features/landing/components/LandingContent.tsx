import Link from "next/link";
import { useT } from "@/shared/config/i18n";
import { Logo, TryItButton, LocaleSwitcher } from "@/shared/components";
import { HugeiconsIcon } from "@hugeicons/react";
import { BrandIcon, CitationIcon, GroundedIcon, PrivacyIcon } from "@/shared/assets/icons";

export function LandingContent() {
	const t = useT();

	const features = [
		{ icon: CitationIcon, title: t("landing.feature1Title"), body: t("landing.feature1Body") },
		{ icon: GroundedIcon, title: t("landing.feature2Title"), body: t("landing.feature2Body") },
		{ icon: PrivacyIcon, title: t("landing.feature3Title"), body: t("landing.feature3Body") },
	];

	return (
		<main className="relative flex min-h-dvh flex-col overflow-hidden">
			<div
				aria-hidden
				className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_40rem_at_50%_-10%,var(--accent),transparent_70%),radial-gradient(40rem_30rem_at_110%_10%,color-mix(in_oklch,var(--primary)_18%,transparent),transparent_70%)]"
			/>

			<header className="flex items-center justify-between px-6 py-5 sm:px-10">
				<Logo />
				<div className="flex items-center gap-4">
					<LocaleSwitcher />
					<Link
						href="/sign-in"
						className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
					>
						{t("auth.signIn")}
					</Link>
					<Link
						href="/sign-up"
						className="text-sm font-medium text-foreground/70 transition-colors hover:text-foreground"
					>
						{t("auth.signUp")}
					</Link>
				</div>
			</header>

			<div className="flex flex-1 flex-col items-center justify-center gap-14 px-6 py-12 text-center">
				<div className="flex max-w-2xl flex-col items-center gap-6">
					<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-foreground/70 shadow-sm backdrop-blur">
						<HugeiconsIcon icon={BrandIcon} className="size-3.5 text-primary" />
						{t("landing.eyebrow")}
					</span>

					<h1 className="bg-gradient-to-br from-foreground to-foreground/55 bg-clip-text pb-1 text-5xl leading-none font-semibold tracking-tight text-balance text-transparent sm:text-6xl">
						{t("landing.title")}
					</h1>

					<p className="max-w-xl text-lg text-pretty text-foreground/60">{t("landing.subtitle")}</p>

					<div className="mt-2 flex flex-col items-center gap-3">
						<TryItButton />
						<p className="text-xs text-foreground/50">{t("landing.guestNote")}</p>
					</div>
				</div>

				<div className="grid w-full max-w-4xl gap-4 sm:grid-cols-3">
					{features.map((feature) => (
						<div
							key={feature.title}
							className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background/70 p-6 text-center shadow-sm backdrop-blur transition-colors hover:border-primary/30 sm:items-start sm:text-start"
						>
							<span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
								<HugeiconsIcon icon={feature.icon} className="size-5" />
							</span>
							<h2 className="text-sm font-semibold tracking-tight">{feature.title}</h2>
							<p className="text-sm text-pretty text-foreground/60">{feature.body}</p>
						</div>
					))}
				</div>
			</div>
		</main>
	);
}
