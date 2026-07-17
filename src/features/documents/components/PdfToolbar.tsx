"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { useT } from "@/shared/config/i18n";
import { Button } from "@/shared/ui/button";
import { ZoomInIcon, ZoomOutIcon, ExpandIcon, CollapseIcon } from "@/shared/assets/icons";

interface PdfToolbarProps {
	currentPage: number;
	numPages: number;
	canZoomIn: boolean;
	canZoomOut: boolean;
	isExpanded: boolean;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onToggleExpand: () => void;
}

export function PdfToolbar({
	currentPage,
	numPages,
	canZoomIn,
	canZoomOut,
	isExpanded,
	onZoomIn,
	onZoomOut,
	onToggleExpand,
}: PdfToolbarProps) {
	const t = useT();

	return (
		<div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-background/95 px-2 py-1.5 backdrop-blur">
			<div className="flex items-center gap-1">
				<Button
					variant="ghost"
					size="icon"
					aria-label={t("workspace.zoomOut")}
					disabled={!canZoomOut}
					onClick={onZoomOut}
				>
					<HugeiconsIcon icon={ZoomOutIcon} />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					aria-label={t("workspace.zoomIn")}
					disabled={!canZoomIn}
					onClick={onZoomIn}
				>
					<HugeiconsIcon icon={ZoomInIcon} />
				</Button>
			</div>

			<span className="text-xs font-medium text-foreground/60 tabular-nums">
				{t("workspace.pageOf", { current: currentPage, total: numPages })}
			</span>

			<Button
				variant="ghost"
				size="icon"
				aria-label={isExpanded ? t("workspace.collapse") : t("workspace.expand")}
				onClick={onToggleExpand}
			>
				<HugeiconsIcon icon={isExpanded ? CollapseIcon : ExpandIcon} />
			</Button>
		</div>
	);
}
