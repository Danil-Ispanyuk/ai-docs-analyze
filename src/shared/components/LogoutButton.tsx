"use client";

import { useTransition } from "react";
import { signOut } from "@/features/auth/actions";
import { useT } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/button";

export function LogoutButton({ className }: { className?: string }) {
	const t = useT();
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			variant="outline"
			className={className}
			disabled={isPending}
			onClick={() => startTransition(() => signOut())}
		>
			{isPending && (
				<span
					className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
					aria-hidden
				/>
			)}
			{t("workspace.logout")}
		</Button>
	);
}
