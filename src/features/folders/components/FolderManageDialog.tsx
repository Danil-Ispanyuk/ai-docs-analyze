"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { renameFolder, deleteFolder } from "@/features/folders/actions";
import { useT } from "@/shared/config/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { MoreIcon, DeleteIcon } from "@/shared/assets/icons";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/ui/dialog";

interface FolderManageDialogProps {
	folderId: string;
	name: string;
}

export function FolderManageDialog({ folderId, name }: FolderManageDialogProps) {
	const t = useT();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [value, setValue] = useState(name);
	const [isPending, startTransition] = useTransition();

	const handleRename = () => {
		if (!value.trim() || value.trim() === name) {
			setOpen(false);
			return;
		}
		startTransition(async () => {
			const result = await renameFolder(folderId, value);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setOpen(false);
			router.refresh();
			toast.success(t("Folders.renameSuccess"));
		});
	};

	const handleDelete = () => {
		startTransition(async () => {
			const result = await deleteFolder(folderId);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setOpen(false);
			router.refresh();
			toast.success(t("Folders.deleteSuccess"));
		});
	};

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (next) setValue(name);
			}}
		>
			<DialogTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("Folders.manage")}
						className="shrink-0 text-foreground/40 hover:text-foreground"
						onClick={(event) => event.stopPropagation()}
					>
						<HugeiconsIcon icon={MoreIcon} className="size-4" />
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("Folders.manageTitle")}</DialogTitle>
				</DialogHeader>
				<Input
					autoFocus
					value={value}
					placeholder={t("Folders.namePlaceholder")}
					onChange={(event) => setValue(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							handleRename();
						}
					}}
				/>
				<DialogFooter className="sm:justify-between">
					<Button
						type="button"
						variant="ghost"
						onClick={handleDelete}
						disabled={isPending}
						className="text-destructive hover:text-destructive"
					>
						<HugeiconsIcon icon={DeleteIcon} className="me-1.5 size-4" />
						{t("Folders.delete")}
					</Button>
					<div className="flex gap-2 sm:justify-end">
						<DialogClose render={<Button variant="outline">{t("Folders.cancel")}</Button>} />
						<Button onClick={handleRename} disabled={isPending || !value.trim()}>
							{t("Folders.save")}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
