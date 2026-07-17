"use client";

import { useTransition } from "react";
import { useT } from "@/shared/config/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { createCheckoutSession } from "@/features/billing/actions";

export function UpgradeButton() {
	const t = useT();
	const [isPending, startTransition] = useTransition();

	const handleUpgrade = () => {
		startTransition(async () => {
			const result = await createCheckoutSession();
			if (result.url) {
				window.location.href = result.url;
				return;
			}
			toast.error(result.error ?? t("workspace.upgradeError"));
		});
	};

	return (
		<Button size="sm" onClick={handleUpgrade} disabled={isPending}>
			{isPending ? t("workspace.upgrading") : t("workspace.upgrade")}
		</Button>
	);
}
