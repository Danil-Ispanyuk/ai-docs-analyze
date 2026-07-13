import { cn } from "@/shared/lib/utils";

interface UsageMeterProps {
	label: string;
	valueLabel: string;
	percent: number;
	hint?: string;
	className?: string;
}

export function UsageMeter({ label, valueLabel, percent, hint, className }: UsageMeterProps) {
	const clamped = Math.min(100, Math.max(0, percent));
	const barColor =
		percent >= 100 ? "bg-destructive" : percent >= 90 ? "bg-amber-500" : "bg-primary";

	return (
		<div className={cn("space-y-1.5", className)}>
			<div className="flex items-center justify-between gap-2 text-xs">
				<span className="font-medium text-foreground/70">{label}</span>
				<span className="text-foreground/60 tabular-nums">{valueLabel}</span>
			</div>
			<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
				<div
					className={cn("h-full rounded-full transition-all", barColor)}
					style={{ width: `${clamped}%` }}
				/>
			</div>
			{hint && <p className="text-end text-[0.7rem] text-foreground/45">{hint}</p>}
		</div>
	);
}
