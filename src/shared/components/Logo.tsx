"use client";

import Link from "next/link";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { BrandIcon } from "@/shared/assets/icons";
import { signOut } from "@/features/auth/actions";

interface LogoProps {
	isGuest?: boolean;
	iconOnly?: boolean;
	className?: string;
}

export function Logo({ isGuest, iconOnly = false, className }: LogoProps) {
	const t = useT();

	const content = (
		<>
			<span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-sm ring-1 ring-white/15 ring-inset">
				<HugeiconsIcon icon={BrandIcon} className="size-[1.15rem]" />
			</span>
			{!iconOnly && (
				<span className="text-[0.95rem] font-semibold tracking-tight">{t("General.title")}</span>
			)}
		</>
	);

	// Guests have no persisted workspace to return to — the logo ends their session.
	// Signed-in users get a plain link back to the workspace (e.g. from /profile).
	if (isGuest) {
		return (
			<span
				className={cn("flex cursor-pointer items-center gap-2", className)}
				onClick={() => signOut()}
			>
				{content}
			</span>
		);
	}

	return (
		<Link href="/" className={cn("flex items-center gap-2", className)}>
			{content}
		</Link>
	);
}
