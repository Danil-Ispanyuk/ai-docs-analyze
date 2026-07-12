"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { createClient } from "@/shared/config/supabase/client";
import { createDocument, ingestDocument, removeDocument } from "@/features/documents/actions";
import { DOCUMENTS_BUCKET, type DocumentRow } from "@/features/documents/service";
import { getPlanLimits, formatStorage } from "@/features/billing/service";
import { toast } from "@/shared/lib/toast";
import { RemoveDocumentModal } from "./modals/RemoveDocument";
import { UsageMeter } from "@/features/billing/components/UsageMeter";
import { Button } from "@/shared/ui/button";
import { DOCUMENT_STATUSES } from "@/shared/constants/general";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	DocumentIcon,
	UploadIcon,
	CloseIcon,
	InformationCircleIcon,
	RetryIcon,
} from "@/shared/assets/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";

function DocumentStatusBadge({ status }: { status: string }) {
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

interface UploadZoneProps {
	userId: string;
	plan: string;
	documents: DocumentRow[];
	selectedDocId: string | null;
	handleSelectDocument: (id: string | null) => void;
	className?: string;
}

export function UploadZone({
	userId,
	plan,
	documents,
	handleSelectDocument,
	selectedDocId,
	className,
}: UploadZoneProps) {
	const t = useT();
	const router = useRouter();
	const limits = getPlanLimits(plan);
	const maxFileSizeMb =
		limits.maxFileSize === null ? undefined : Math.round(limits.maxFileSize / (1024 * 1024));
	const atFileLimit = limits.maxFiles !== null && documents.length >= limits.maxFiles;

	const usedBytes = documents.reduce((sum, document) => sum + (document.size ?? 0), 0);
	const remainingBytes = Math.max(0, limits.storageLimit - usedBytes);
	const storagePercent = (usedBytes / limits.storageLimit) * 100;
	const atStorageLimit = remainingBytes <= 0;
	const isBlocked = atFileLimit || atStorageLimit;
	const [isUploading, startUpload] = useTransition();
	const [isRemoving, startRemove] = useTransition();
	const [isReingesting, startReingest] = useTransition();
	const [isDragging, setIsDragging] = useState(false);

	const handleFile = (file: File) => {
		if (file.type !== "application/pdf") {
			toast.error(t("Workspace.fileTypeError"));
			return;
		}
		if (limits.maxFileSize !== null && file.size > limits.maxFileSize) {
			const maxFileSizeMb = Math.round(limits.maxFileSize / (1024 * 1024));
			toast.error(t("Workspace.fileSizeError", { size: maxFileSizeMb }));
			return;
		}
		if (usedBytes + file.size > limits.storageLimit) {
			toast.error(t("Workspace.storageError", { size: formatStorage(limits.storageLimit) }));
			return;
		}

		startUpload(async () => {
			const supabase = createClient();
			const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;

			const { error: uploadError } = await supabase.storage
				.from(DOCUMENTS_BUCKET)
				.upload(storagePath, file, { contentType: "application/pdf" });

			if (uploadError) {
				toast.error(uploadError.message);
				return;
			}

			const result = await createDocument({ name: file.name, storagePath });
			router.refresh();
			if (result.error || !result.documentId) {
				toast.error(result.error ?? t("Workspace.uploadError"));
				return;
			}
			toast.success(t("Workspace.uploadQueued"));
			// Ingest without blocking the upload transition; refresh when it settles.
			runIngestion(result.documentId);
		});
	};

	// Fire-and-forget ingestion: the doc is already visible as `pending`, so we just
	// refresh once it flips to ready/error rather than blocking the UI on it.
	const runIngestion = (documentId: string) => {
		ingestDocument(documentId).then((res) => {
			if (res?.error) toast.error(t("Workspace.uploadError"));
			router.refresh();
		});
	};

	const handleReingest = (id: string) => {
		startReingest(async () => {
			const res = await ingestDocument(id);
			if (res?.error) toast.error(t("Workspace.uploadError"));
			router.refresh();
		});
	};

	const handleRemove = (id: string) => {
		startRemove(async () => {
			const result = await removeDocument(id);
			if (result?.error) {
				toast.error(result.error);
				return;
			}
			if (selectedDocId === id) handleSelectDocument(null);
			router.refresh();
			toast.success(t("Workspace.removeSuccess"));
		});
	};

	return (
		<aside
			className={cn(
				"flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm",
				className,
			)}
		>
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
					(isUploading || isBlocked) && "pointer-events-none opacity-60",
				)}
			>
				<input
					type="file"
					accept="application/pdf,.pdf"
					className="sr-only"
					disabled={isUploading || isBlocked}
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
				) : atFileLimit ? (
					<>
						<HugeiconsIcon icon={InformationCircleIcon} className="size-6 text-foreground/40" />
						<span className="text-sm font-medium">{t("Workspace.uploadLimitReached")}</span>
					</>
				) : (
					<>
						<HugeiconsIcon icon={UploadIcon} className="size-6 text-foreground/40" />
						<span className="text-sm font-medium">{t("Workspace.uploadTitle")}</span>
						<span className="text-xs text-foreground/60">{t("Workspace.uploadHint")}</span>
					</>
				)}
			</label>

			<div className="space-y-2">
				<UsageMeter
					label={t("Workspace.storageLabel")}
					valueLabel={t("Workspace.storageUsage", {
						used: formatStorage(usedBytes),
						max: formatStorage(limits.storageLimit),
					})}
					percent={storagePercent}
					hint={
						atStorageLimit
							? t("Workspace.storageFull")
							: t("Workspace.storageLeft", { size: formatStorage(remainingBytes) })
					}
				/>
				{maxFileSizeMb && (
					<p className="flex flex-wrap items-center justify-center gap-x-2 text-center text-xs text-foreground/50">
						<span>{t("Workspace.uploadMaxSize", { size: maxFileSizeMb })}</span>
						{limits.maxFiles !== null && (
							<>
								<span aria-hidden>·</span>
								<span>
									{t("Workspace.uploadFileCount", {
										count: documents.length,
										max: limits.maxFiles,
									})}
								</span>
							</>
						)}
					</p>
				)}
			</div>

			{documents.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-foreground/40">
					<HugeiconsIcon icon={DocumentIcon} className="size-6" />
					<p className="text-xs">{t("Workspace.documentsEmpty")}</p>
				</div>
			) : (
				<ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1">
					<li>
						<div
							role="button"
							tabIndex={0}
							onClick={() => handleSelectDocument(null)}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									handleSelectDocument(null);
								}
							}}
							className={cn(
								"flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
								selectedDocId === null
									? "border-primary bg-primary/5 text-primary"
									: "border-border text-foreground/70 hover:bg-muted/50",
							)}
						>
							<div className="flex w-full items-center gap-2">
								<HugeiconsIcon icon={DocumentIcon} className="size-6" />
								{t("Workspace.allDocuments")}
							</div>
							<Tooltip>
								<TooltipTrigger onClick={(event) => event.stopPropagation()}>
									<HugeiconsIcon className="cursor-pointer" icon={InformationCircleIcon} />
								</TooltipTrigger>
								<TooltipContent>
									<p>{t("Workspace.allDocumentsHint")}</p>
								</TooltipContent>
							</Tooltip>
						</div>
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
												handleReingest(document.id);
											}}
											className="shrink-0 text-foreground/40 transition hover:text-primary"
										>
											<HugeiconsIcon icon={RetryIcon} className="size-3.5" />
										</Button>
									)}

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
											className="shrink-0 text-foreground/40 opacity-0 transition group-hover:opacity-100 hover:text-destructive"
										>
											<HugeiconsIcon icon={CloseIcon} className="size-3.5" />
										</Button>
									</RemoveDocumentModal>
								</div>
							</li>
						);
					})}
				</ul>
			)}

			{documents.length > 0 && selectedDocId === null && (
				<div className="flex gap-2 rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-foreground/70 md:hidden">
					<HugeiconsIcon
						icon={InformationCircleIcon}
						className="mt-0.5 size-4 shrink-0 text-primary"
					/>
					<p>{t("Workspace.allDocumentsInfo")}</p>
				</div>
			)}
		</aside>
	);
}
