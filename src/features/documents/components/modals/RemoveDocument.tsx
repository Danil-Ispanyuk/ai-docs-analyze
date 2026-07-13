import { Button } from "@/shared/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/shared/ui/dialog";
import { useT } from "@/shared/config/i18n";
import { type ReactElement } from "react";

interface RemoveDocumentModalProps {
	documentTitle: string;
	onSubmit: () => void;
	children: ReactElement;
}

export function RemoveDocumentModal({
	children,
	documentTitle,
	onSubmit,
}: RemoveDocumentModalProps) {
	const t = useT();
	return (
		<Dialog>
			<DialogTrigger render={children} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("Workspace.modal.document.removeTitle")}</DialogTitle>
				</DialogHeader>
				<DialogDescription>
					{t("Workspace.modal.document.removeDescription", {
						document: documentTitle,
					})}
				</DialogDescription>
				<DialogFooter showCloseButton className="flex justify-between">
					<Button onClick={onSubmit}>{t("Workspace.modal.confirm")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
