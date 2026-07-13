"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFolder } from "@/features/folders/actions";
import { useT } from "@/shared/config/i18n";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { HugeiconsIcon } from "@hugeicons/react";
import { FolderAddIcon } from "@/shared/assets/icons";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/ui/dialog";

export function NewFolderButton() {
	const t = useT();
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [name, setName] = useState("");
	const [isPending, startTransition] = useTransition();

	const handleCreate = () => {
		if (!name.trim()) return;
		startTransition(async () => {
			const result = await createFolder(name);
			if (result.error) {
				toast.error(result.error);
				return;
			}
			setName("");
			setOpen(false);
			router.refresh();
			toast.success(t("Folders.createSuccess"));
		});
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger
				render={
					<Button
						type="button"
						variant="ghost"
						size="icon-sm"
						aria-label={t("Folders.newFolder")}
						className="shrink-0 text-foreground/50 hover:text-primary"
					>
						<HugeiconsIcon icon={FolderAddIcon} className="size-4" />
					</Button>
				}
			/>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("Folders.newFolder")}</DialogTitle>
				</DialogHeader>
				<Input
					autoFocus
					value={name}
					placeholder={t("Folders.namePlaceholder")}
					onChange={(event) => setName(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							event.preventDefault();
							handleCreate();
						}
					}}
				/>
				<DialogFooter className="sm:justify-end">
					<DialogClose render={<Button variant="outline">{t("Folders.cancel")}</Button>} />
					<Button onClick={handleCreate} disabled={isPending || !name.trim()}>
						{isPending && (
							<span
								className="me-2 size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
								aria-hidden
							/>
						)}
						{t("Folders.create")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
