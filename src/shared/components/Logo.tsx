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
			<span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-sm ring-1 ring-white/15 ring-inset">
				<HugeiconsIcon icon={BrandIcon} className="size-[1.15rem]" />
			</span>
			{!iconOnly && (
				<span className="truncate text-[0.95rem] font-semibold tracking-tight">
					{t("General.title")}
				</span>
			)}
		</>
	);

	if (isGuest) {
		return (
			<span
				className={cn("flex min-w-0 cursor-pointer items-center gap-2", className)}
				onClick={() => signOut()}
			>
				{content}
			</span>
		);
	}

	return (
		<Link href="/" className={cn("flex min-w-0 items-center gap-2", className)}>
			{content}
		</Link>
	);
}
