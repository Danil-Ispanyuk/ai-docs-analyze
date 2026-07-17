"use client";

import { useState, useTransition } from "react";
import { useT } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/button";
import { signInAnonymously } from "@/features/auth/actions";

export function TryItButton() {
	const t = useT();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	const handleTryIt = () => {
		setError(null);
		startTransition(async () => {
			const result = await signInAnonymously();
			if (result?.error) setError(result.error);
		});
	};

	return (
		<div className="flex flex-col items-center gap-2">
			<Button size="lg" onClick={handleTryIt} disabled={isPending}>
				{isPending && (
					<span
						className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
						aria-hidden
					/>
				)}
				{isPending ? t("landing.tryingIt") : t("landing.tryIt")}
			</Button>
			{error && (
				<p className="text-sm text-destructive" role="alert">
					{error}
				</p>
			)}
		</div>
	);
}
