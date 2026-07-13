import Link from "next/link";
import { UpgradeButton } from "@/features/billing/components/UpgradeButton";
import { useT } from "@/shared/config/i18n";
import { PLAN_TYPES } from "@/shared/constants/general";
import { Button } from "@/shared/ui/button";
import { LogoutButton } from "./LogoutButton";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { Logo } from "./Logo";

type HeaderProps = {
	isGuest: boolean;
	email: string;
	plan: string;
};

export function Header({ isGuest, email, plan }: HeaderProps) {
	const t = useT();

	return (
		<header className="flex items-center justify-between gap-4 border-b border-border bg-background/80 px-6 py-3 backdrop-blur">
			<Logo isGuest={isGuest} />
			<div className="flex items-center gap-3">
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
					{isGuest ? t("Workspace.guestSession") : t("Workspace.signedInAs", { email })}
				</span>
				{!isGuest && (
					<Button variant="ghost" size="sm" render={<Link href="/profile" />}>
						{t("Workspace.profile")}
					</Button>
				)}
				{!isGuest && <LogoutButton />}
			</div>
		</header>
	);
}
