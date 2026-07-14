import Link from "next/link";
import { UpgradeButton } from "@/features/billing/components/UpgradeButton";
import { useT } from "@/shared/config/i18n";
import { PLAN_TYPES } from "@/shared/constants/general";
import { Button } from "@/shared/ui/button";
import { AccountMenu } from "./AccountMenu";
import { LogoutButton } from "./LogoutButton";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

type HeaderProps = {
	isGuest: boolean;
	email: string;
	fullName?: string | null;
	plan: string;
};

export function Header({ isGuest, email, fullName, plan }: HeaderProps) {
	const t = useT();

	return (
		<header className="flex items-center justify-between gap-2 border-b border-border bg-background/80 px-3 py-3 backdrop-blur sm:gap-4 sm:px-6">
			<Logo isGuest={isGuest} />
			<div className="flex items-center gap-1.5 sm:gap-3">
				<LocaleSwitcher />
				{isGuest ? (
					<>
						<Button variant="ghost" size="sm" render={<Link href="/sign-in" />}>
							{t("Auth.signIn")}
						</Button>
						<Button size="sm" render={<Link href="/save-account" />}>
							{t("Auth.saveAccount")}
						</Button>
					</>
				) : (
					plan !== PLAN_TYPES.PRO && !isGuest && <UpgradeButton />
				)}
				<span className="hidden text-sm text-foreground/60 sm:inline">
					{isGuest
						? t("Workspace.guestSession")
						: t("Workspace.greeting", { name: fullName?.trim() || email })}
				</span>
				{!isGuest && (
					<>
						{/* Inline on ≥sm; collapsed into a compact menu on phones. */}
						<Button
							variant="ghost"
							size="sm"
							className="hidden sm:inline-flex"
							render={<Link href="/profile" />}
						>
							{t("Workspace.profile")}
						</Button>
						<LogoutButton className="hidden sm:inline-flex" />
						<AccountMenu className="sm:hidden" />
					</>
				)}
			</div>
		</header>
	);
}
