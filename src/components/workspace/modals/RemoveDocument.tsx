import { Button } from "@/elements/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "@/elements/dialog";
import { useT } from "@/i18n";
import { type ReactElement } from "react";

interface IRemoveDocument {
	documentTitle: string;
	onSubmit: () => void;
	// The trigger element (e.g. the ✕ button). Passed via `render` so Base UI
	// turns it INTO the trigger instead of wrapping it in another <button>.
	children: ReactElement;
}

export function RemoveDocumentModal({ children, documentTitle, onSubmit }: IRemoveDocument) {
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
						document: documentTitle
					})}
				</DialogDescription>
				<DialogFooter showCloseButton className="flex justify-between">
					<Button onClick={onSubmit}>{t("Workspace.modal.confirm")}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
