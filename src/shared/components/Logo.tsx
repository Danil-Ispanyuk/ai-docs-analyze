import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { BrandIcon } from "@/shared/assets/icons";

interface LogoProps {
	iconOnly?: boolean;
	className?: string;
}

export function Logo({ iconOnly = false, className }: LogoProps) {
	const t = useT();

	return (
		<span className={cn("flex items-center gap-2", className)}>
			<span className="flex size-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-4 text-primary-foreground shadow-sm ring-1 ring-white/15 ring-inset">
				<HugeiconsIcon icon={BrandIcon} className="size-[1.15rem]" />
			</span>
			{!iconOnly && (
				<span className="text-[0.95rem] font-semibold tracking-tight">{t("General.title")}</span>
			)}
		</span>
	);
}
