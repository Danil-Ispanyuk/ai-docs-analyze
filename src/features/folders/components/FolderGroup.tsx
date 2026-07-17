"use client";

import { useState, type ReactNode } from "react";
import type { FolderRow } from "@/features/folders/service";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { HugeiconsIcon } from "@hugeicons/react";
import { FolderIcon, ChevronDownIcon, ChevronRightIcon } from "@/shared/assets/icons";
import { FolderManageDialog } from "./FolderManageDialog";

interface FolderGroupProps {
	folder: FolderRow;
	isActive: boolean;
	count: number;
	onSelect: () => void;
	children: ReactNode;
}

export function FolderGroup({ folder, isActive, count, onSelect, children }: FolderGroupProps) {
	const t = useT();
	const [open, setOpen] = useState(true);

	return (
		<li className="space-y-1">
			<div
				className={cn(
					"group flex items-center gap-1 rounded-xl border px-2 py-2 transition-colors",
					isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
				)}
			>
				<button
					type="button"
					aria-label={open ? t("folders.collapse") : t("folders.expand")}
					onClick={() => setOpen((previous) => !previous)}
					className="shrink-0 rounded-md p-0.5 text-foreground/40 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
				>
					<HugeiconsIcon
						icon={open ? ChevronDownIcon : ChevronRightIcon}
						className="size-4 rtl:-scale-x-100"
					/>
				</button>
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
						"flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md text-start text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
						isActive ? "text-primary" : "text-foreground/80",
					)}
				>
					<HugeiconsIcon icon={FolderIcon} className="size-5 shrink-0" />
					<span className="min-w-0 flex-1 truncate font-medium">{folder.name}</span>
					<span className="shrink-0 text-xs text-foreground/40">{count}</span>
				</div>
				<FolderManageDialog folderId={folder.id} name={folder.name} />
			</div>
			{open && <ul className="space-y-1.5 ps-4">{children}</ul>}
		</li>
	);
}
