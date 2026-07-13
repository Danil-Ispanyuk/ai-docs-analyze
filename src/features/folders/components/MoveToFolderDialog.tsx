"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { moveDocumentToFolder } from "@/features/folders/actions";
import type { FolderRow } from "@/features/folders/service";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { FolderIcon } from "@/shared/assets/icons";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/ui/dialog";

interface MoveToFolderDialogProps {
	documentId: string;
	currentFolderId: string | null;
	folders: FolderRow[];
}

export function MoveToFolderDialog({
	documentId,
	currentFolderId,
	folders,
}: MoveToFolderDialogProps) {
	const t = useT();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [isPending, startTransition] = useTransition();

	const handleMove = (folderId: string | null) => {
		if (folderId === currentFolderId) {
			setOpen(false);
			return;
		}
		startTransition(async () => {
			const result = await moveDocumentToFolder(documentId, folderId);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setOpen(false);
			router.refresh();
			toast.success(t("Folders.moveSuccess"));
		});
	};

	const options: { id: string | null; label: string }[] = [
		{ id: null, label: t("Folders.noFolder") },
		...folders.map((folder) => ({ id: folder.id, label: folder.name })),
	];

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("Folders.moveToFolder")}
						className="shrink-0 text-foreground/40 opacity-0 transition group-hover:opacity-100 hover:text-primary"
						onClick={(event) => event.stopPropagation()}
					>
						<HugeiconsIcon icon={FolderIcon} className="size-3.5" />
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("Folders.moveToFolder")}</DialogTitle>
				</DialogHeader>
				<ul className="flex flex-col gap-1">
					{options.map((option) => (
						<li key={option.id ?? "none"}>
							<Button
								type="button"
								variant="ghost"
								disabled={isPending}
								onClick={() => handleMove(option.id)}
								className={cn(
									"w-full justify-start font-normal",
									option.id === currentFolderId && "bg-muted text-foreground",
								)}
							>
								<HugeiconsIcon icon={FolderIcon} className="mr-2 size-4 text-foreground/50" />
								{option.label}
								{option.id === currentFolderId && (
									<span className="ml-auto text-xs text-foreground/50">{t("Folders.current")}</span>
								)}
							</Button>
						</li>
					))}
				</ul>
			</DialogContent>
		</Dialog>
	);
}
