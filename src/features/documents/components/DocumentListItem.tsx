"use client";

import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import type { DocumentRow } from "@/features/documents/service";
import type { FolderRow } from "@/features/folders/service";
import { MoveToFolderDialog } from "@/features/folders/components";
import { RemoveDocumentModal } from "./modals/RemoveDocument";
import { DocumentStatusBadge } from "./DocumentStatusBadge";
import { Button } from "@/shared/ui/button";
import { DOCUMENT_STATUSES } from "@/shared/constants/general";
import { HugeiconsIcon } from "@hugeicons/react";
import { DocumentIcon, CloseIcon, RetryIcon } from "@/shared/assets/icons";

interface DocumentListItemProps {
	document: DocumentRow;
	folders: FolderRow[];
	isActive: boolean;
	onSelect: () => void;
	onReingest: () => void;
	onRemove: () => void;
	isReingesting: boolean;
	isRemoving: boolean;
}

export function DocumentListItem({
	document,
	folders,
	isActive,
	onSelect,
	onReingest,
	onRemove,
	isReingesting,
	isRemoving,
}: DocumentListItemProps) {
	const t = useT();

	return (
		<li>
			<div
				role="button"
				tabIndex={0}
				onClick={onSelect}
				onKeyDown={(event) => {
					if (event.key === "Enter" || event.key === " ") {
						event.preventDefault();
						onSelect();
					}
				}}
				className={cn(
					"group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
					isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
				)}
			>
				<HugeiconsIcon
					icon={DocumentIcon}
					className={cn("size-6", isActive ? "text-primary" : "text-foreground/40")}
				/>
				<span className="min-w-0 flex-1 truncate text-sm">{document.name}</span>

				<DocumentStatusBadge status={document.status} />

				{document.status === DOCUMENT_STATUSES.ERROR && (
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("Workspace.retry")}
						disabled={isReingesting}
						onClick={(event) => {
							event.stopPropagation();
							onReingest();
						}}
						className="shrink-0 text-foreground/40 transition hover:text-primary"
					>
						<HugeiconsIcon icon={RetryIcon} className="size-3.5" />
					</Button>
				)}

				<MoveToFolderDialog
					documentId={document.id}
					currentFolderId={document.folder_id}
					folders={folders}
				/>

				<RemoveDocumentModal onSubmit={onRemove} documentTitle={document.name}>
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("Workspace.remove")}
						disabled={isRemoving}
						className="shrink-0 text-foreground/40 opacity-0 transition group-hover:opacity-100 hover:text-destructive"
					>
						<HugeiconsIcon icon={CloseIcon} className="size-3.5" />
					</Button>
				</RemoveDocumentModal>
			</div>
		</li>
	);
}
