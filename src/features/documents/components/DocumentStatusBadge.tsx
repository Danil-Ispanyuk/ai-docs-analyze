"use client";

import { useT } from "@/shared/config/i18n";
import { DOCUMENT_STATUSES } from "@/shared/constants/general";

export function DocumentStatusBadge({ status }: { status: string }) {
	const t = useT();

	if (status === DOCUMENT_STATUSES.PENDING) {
		return (
			<span className="shrink-0 text-xs text-foreground/50">{t("Workspace.statusPending")}</span>
		);
	}

	if (status === DOCUMENT_STATUSES.PROCESSING) {
		return (
			<span className="flex shrink-0 items-center gap-1 text-xs text-foreground/50">
				<span
					className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent"
					aria-hidden
				/>
				{t("Workspace.statusProcessing")}
			</span>
		);
	}

	if (status === DOCUMENT_STATUSES.ERROR) {
		return <span className="shrink-0 text-xs text-destructive">{t("Workspace.statusError")}</span>;
	}

	if (status === DOCUMENT_STATUSES.READY) {
		return (
			<span className="shrink-0 text-xs text-emerald-600 dark:text-emerald-500">
				{t("Workspace.statusReady")}
			</span>
		);
	}

	return null;
}
