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
import { useState, type ReactElement } from "react";

interface RemoveDocumentModalProps {
	documentTitle: string;
	onSubmit: () => void;
	pending?: boolean;
	children: ReactElement;
}

export function RemoveDocumentModal({
	children,
	documentTitle,
	onSubmit,
	pending = false,
}: RemoveDocumentModalProps) {
	const t = useT();
	const [open, setOpen] = useState(false);

	const handleConfirm = () => {
		onSubmit();
		setOpen(false);
	};

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger render={children} />
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{t("workspace.modal.document.removeTitle")}</DialogTitle>
				</DialogHeader>
				<DialogDescription>
					{t("workspace.modal.document.removeDescription", {
						document: documentTitle,
					})}
				</DialogDescription>
				<DialogFooter showCloseButton className="flex justify-between">
					<Button variant="destructive" onClick={handleConfirm} disabled={pending}>
						{t("workspace.modal.confirm")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
