"use client";

import Link from "next/link";
import { useTransition } from "react";
import { signOut } from "@/features/auth/actions";
import { useT } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/button";
import { Menu, MenuContent, MenuItem, MenuLinkItem, MenuTrigger } from "@/shared/ui/menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreIcon } from "@/shared/assets/icons";

export function AccountMenu({ className }: { className?: string }) {
	const t = useT();
	const [isPending, startTransition] = useTransition();

	return (
		<Menu>
			<MenuTrigger
				render={
					<Button
						variant="outline"
						size="icon-sm"
						aria-label={t("workspace.accountMenu")}
						className={className}
					>
						<HugeiconsIcon icon={MoreIcon} className="size-4" />
					</Button>
				}
			/>
			<MenuContent>
				<MenuLinkItem render={<Link href="/profile" />}>{t("workspace.profile")}</MenuLinkItem>
				<MenuItem
					disabled={isPending}
					onClick={() => startTransition(() => signOut())}
					className="text-destructive data-highlighted:text-destructive"
				>
					{t("workspace.logout")}
				</MenuItem>
			</MenuContent>
		</Menu>
	);
}
