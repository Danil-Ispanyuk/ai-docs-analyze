"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { createDocument, removeDocument } from "@/actions/documents";
import { DOCUMENTS_BUCKET, MAX_FILE_SIZE, type DocumentRow } from "@/lib/documents";
import { DocumentIcon, UploadIcon, CloseIcon } from "./icons";
import { RemoveDocumentModal } from "./modals/RemoveDocument";
import { Button } from "@/elements/button";
import { DOCUMENT_STATUSES } from "@/constants/documents";

function DocumentStatusBadge({ status }: { status: string }) {
	const t = useT();

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

interface UploadZoneProps {
	userId: string;
	documents: DocumentRow[];
	selectedDocId: string | null;
	handleSelectDocument: (id: string | null) => void;
	className?: string;
}

export function UploadZone({ userId, documents, handleSelectDocument, selectedDocId, className }: UploadZoneProps) {
	const t = useT();
	const router = useRouter();
	const [isUploading, startUpload] = useTransition();
	const [isRemoving, startRemove] = useTransition();
	const [error, setError] = useState<string | null>(null);
	const [isDragging, setIsDragging] = useState(false);

	const handleFile = (file: File) => {
		setError(null);

		if (file.type !== "application/pdf") {
			setError(t("Workspace.fileTypeError"));
			return;
		}
		if (file.size > MAX_FILE_SIZE) {
			setError(t("Workspace.fileSizeError"));
			return;
		}

		startUpload(async () => {
			const supabase = createClient();
			const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;

			const { error: uploadError } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.upload(storagePath, file, { contentType: "application/pdf" });

			if (uploadError) {
				setError(uploadError.message);
				return;
			}

			const result = await createDocument({ name: file.name, storagePath });
			router.refresh();
			if (result?.error) {
				setError(result.error);
			}
		});
	};

	const handleRemove = (id: string) => {
		startRemove(async () => {
			const result = await removeDocument(id);
			if (result?.error) {
				setError(result.error);
				return;
			}
			if (selectedDocId === id) handleSelectDocument(null);
			router.refresh();
		});
	};

	return (
		<aside className={cn("flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm", className)}>
			<h2 className="text-sm font-medium text-foreground/80">{t("Workspace.documentsTitle")}</h2>

			<label
				onDragOver={(event) => {
					event.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setIsDragging(false);
					const file = event.dataTransfer.files?.[0];
					if (file) handleFile(file);
				}}
				className={cn(
					"flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border px-4 py-8 text-center transition-colors hover:border-foreground/30 hover:bg-muted/40",
					isDragging && "border-primary bg-primary/5",
					isUploading && "pointer-events-none opacity-60"
				)}
			>
				<input
					type="file"
					accept="application/pdf,.pdf"
					className="sr-only"
					disabled={isUploading}
					onChange={(event) => {
						const file = event.target.files?.[0];
						if (file) handleFile(file);
						event.target.value = "";
					}}
				/>
				{isUploading ? (
					<span className="flex items-center gap-2 text-sm font-medium">
						<span
							className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
							aria-hidden
						/>
						{t("Workspace.uploading")}
					</span>
				) : (
					<>
						<UploadIcon className="size-6 text-foreground/40" />
						<span className="text-sm font-medium">{t("Workspace.uploadTitle")}</span>
						<span className="text-xs text-foreground/60">{t("Workspace.uploadHint")}</span>
					</>
				)}
			</label>

			{error && <p className="text-xs text-destructive">{error}</p>}

			{documents.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-foreground/40">
					<DocumentIcon className="size-7" />
					<p className="text-xs">{t("Workspace.documentsEmpty")}</p>
				</div>
			) : (
				<ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
					<li>
						<button
							type="button"
							onClick={() => handleSelectDocument(null)}
							className={cn(
								"flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
								selectedDocId === null
									? "border-primary bg-primary/5 text-primary"
									: "border-border text-foreground/70 hover:bg-muted/50"
							)}
						>
							<DocumentIcon className="size-4 shrink-0" />
							{t("Workspace.allDocuments")}
						</button>
					</li>
					{documents.map((document) => {
						const isActive = selectedDocId === document.id;
						return (
							<li key={document.id}>
								<div
									role="button"
									tabIndex={0}
									onClick={() => handleSelectDocument(document.id)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											handleSelectDocument(document.id);
										}
									}}
									className={cn(
										"group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
										isActive ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
									)}
								>
									<DocumentIcon className={cn("size-4 shrink-0", isActive ? "text-primary" : "text-foreground/40")} />
									<span className="min-w-0 flex-1 truncate text-sm">{document.name}</span>

									<DocumentStatusBadge status={document.status} />

									<RemoveDocumentModal
										onSubmit={() => handleRemove(document.id)}
										documentTitle={document.name}
									>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											aria-label="Remove"
											disabled={isRemoving}
											className="shrink-0 text-foreground/40 opacity-0 transition hover:text-destructive group-hover:opacity-100"
										>
											<CloseIcon className="size-3.5" />
										</Button>
									</RemoveDocumentModal>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</aside>
	);
}
