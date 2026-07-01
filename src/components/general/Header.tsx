import { useT } from "@/i18n";
import { LogoutButton } from "../auth/LogoutButton";
import { SearchInput } from "./SearchInput";

export function Header({ email }: { email: string }) {
	const t = useT();
	return (
		<header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
			<span className="font-semibold tracking-tight">{t("General.title")}</span>
			<SearchInput placeholder={t("Workspace.searchPlaceholder")} />
			<div className="flex items-center gap-3">
				<span className="hidden text-sm text-foreground/60 sm:inline">
					{t("Workspace.signedInAs", { email })}
				</span>
				<LogoutButton />
			</div>
		</header>
	);
}
