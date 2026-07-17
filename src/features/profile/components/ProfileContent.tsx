import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { HugeiconsIcon } from "@hugeicons/react";
import { UpgradeButton } from "@/features/billing/components/UpgradeButton";
import type { BillingOverview } from "@/features/profile/service";
import { PLAN_TYPES } from "@/shared/constants/general";
import { ArrowLeftIcon } from "@/shared/assets/icons";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { PaymentHistory } from "./PaymentHistory";
import { CancelSubscriptionButton } from "./CancelSubscriptionButton";
import { DeleteAccountButton } from "./DeleteAccountButton";

interface ProfileContentProps {
	overview: BillingOverview;
	email: string;
	fullName: string | null;
}

export async function ProfileContent({ overview, email, fullName }: ProfileContentProps) {
	const t = await getTranslations();
	const locale = await getLocale();

	const isPro = overview.plan === PLAN_TYPES.PRO;
	const planLabel = isPro
		? t("profile.planPro")
		: overview.plan === PLAN_TYPES.GUEST
			? t("profile.planGuest")
			: t("profile.planFree");

	const renewalLabel =
		overview.renewalDate &&
		new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(overview.renewalDate);

	return (
		<div className="mx-auto w-full max-w-2xl space-y-6 px-4 py-8">
			<Link
				href="/"
				className="inline-flex items-center gap-1.5 text-sm text-foreground/60 transition-colors hover:text-foreground"
			>
				<HugeiconsIcon icon={ArrowLeftIcon} className="size-4 rtl:-scale-x-100" />
				{t("profile.back")}
			</Link>
			<h1 className="font-heading text-2xl font-semibold tracking-tight">{t("profile.title")}</h1>

			<section className="space-y-4 rounded-3xl border border-border bg-card p-6 text-card-foreground">
				<div>
					<h2 className="font-heading text-base font-medium">{t("profile.accountTitle")}</h2>
					<dl className="mt-3 space-y-1 text-sm">
						<div className="flex justify-between gap-3">
							<dt className="text-foreground/55">{t("profile.emailLabel")}</dt>
							<dd className="truncate font-medium">{email}</dd>
						</div>
						{fullName && (
							<div className="flex justify-between gap-3">
								<dt className="text-foreground/55">{t("profile.nameLabel")}</dt>
								<dd className="truncate font-medium">{fullName}</dd>
							</div>
						)}
					</dl>
				</div>
				<hr className="border-border" />
				<div>
					<h3 className="text-sm font-medium">{t("profile.changePasswordTitle")}</h3>
					<p className="mt-1 mb-4 text-sm text-foreground/55">
						{t("profile.changePasswordDescription")}
					</p>
					<ChangePasswordForm />
				</div>
			</section>

			<section className="space-y-4 rounded-3xl border border-border bg-card p-6 text-card-foreground">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h2 className="font-heading text-base font-medium">{t("profile.planTitle")}</h2>
						<p className="mt-1 text-sm text-foreground/55">
							{overview.cancelAtPeriodEnd && renewalLabel
								? t("profile.endsOn", { date: renewalLabel })
								: isPro && renewalLabel
									? t("profile.renewsOn", { date: renewalLabel })
									: t("profile.planDescription")}
						</p>
					</div>
					<span className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
						{planLabel}
					</span>
				</div>

				{!isPro && !overview.hasSubscription && (
					<div className="flex items-center justify-between gap-3">
						<p className="text-sm text-foreground/55">{t("profile.upgradePrompt")}</p>
						<UpgradeButton />
					</div>
				)}

				{overview.hasSubscription && !overview.cancelAtPeriodEnd && (
					<div className="flex items-center justify-between gap-3">
						<p className="text-sm text-foreground/55">{t("profile.cancelPrompt")}</p>
						<CancelSubscriptionButton />
					</div>
				)}

				{overview.cancelAtPeriodEnd && (
					<p className="rounded-2xl bg-muted px-4 py-3 text-sm text-foreground/60">
						{renewalLabel
							? t("profile.cancelScheduledNote", { date: renewalLabel })
							: t("profile.cancelScheduled")}
					</p>
				)}
			</section>

			<section className="space-y-4 rounded-3xl border border-border bg-card p-6 text-card-foreground">
				<h2 className="font-heading text-base font-medium">{t("profile.paymentsTitle")}</h2>
				<PaymentHistory invoices={overview.invoices} />
			</section>

			<section className="space-y-4 rounded-3xl border border-destructive/30 bg-card p-6 text-card-foreground">
				<div className="flex items-center justify-between gap-3">
					<div>
						<h2 className="font-heading text-base font-medium text-destructive">
							{t("profile.dangerZoneTitle")}
						</h2>
						<p className="mt-1 text-sm text-foreground/55">
							{t("profile.deleteAccountDescription")}
						</p>
					</div>
					<DeleteAccountButton email={email} />
				</div>
			</section>
		</div>
	);
}
