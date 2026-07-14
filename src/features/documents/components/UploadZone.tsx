"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { createClient } from "@/shared/config/supabase/client";
import { createDocument, ingestDocument, removeDocument } from "@/features/documents/actions";
import { clearChatMessages } from "@/features/chat/actions";
import { DOCUMENTS_BUCKET, type DocumentRow } from "@/features/documents/service";
import type { FolderRow } from "@/features/folders/service";
import type { ChatScope } from "@/features/chat/types";
import { NewFolderButton, FolderGroup } from "@/features/folders/components";
import { getPlanLimits, formatStorage } from "@/features/billing/service";
import { toast } from "@/shared/lib/toast";
import { DocumentListItem } from "./DocumentListItem";
import { UsageMeter } from "@/features/billing/components/UsageMeter";
import { HugeiconsIcon } from "@hugeicons/react";
import { DocumentIcon, UploadIcon, InformationCircleIcon } from "@/shared/assets/icons";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/tooltip";
import { Button } from "@/shared/ui/button";

interface UploadZoneProps {
	userId: string;
	plan: string;
	documents: DocumentRow[];
	folders: FolderRow[];
	scope: ChatScope;
	loadError?: boolean;
	onSelectAll: () => void;
	onSelectDocument: (id: string) => void;
	onSelectFolder: (id: string) => void;
	className?: string;
}

export function UploadZone({
	userId,
	plan,
	documents,
	folders,
	scope,
	loadError = false,
	onSelectAll,
	onSelectDocument,
	onSelectFolder,
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

	const isAllActive = !scope.documentId && !scope.folderId;
	const unfiledDocuments = documents.filter((document) => !document.folder_id);

	const uploadOne = async (file: File): Promise<string | null> => {
		const supabase = createClient();
		const storagePath = `${userId}/${crypto.randomUUID()}.pdf`;

		const { error: uploadError } = await supabase.storage
			.from(DOCUMENTS_BUCKET)
			.upload(storagePath, file, { contentType: "application/pdf" });

		if (uploadError) {
			toast.error(uploadError.message);
			return null;
		}

		const result = await createDocument({ name: file.name, storagePath });
		if (result.error || !result.documentId) {
			toast.error(result.error ?? t("Workspace.uploadError"));
			return null;
		}
		return result.documentId;
	};

	const handleFiles = (fileList: File[]) => {
		// Validate against the plan limits while accumulating, so a batch can't slip
		// past the file-count or storage cap one file at a time.
		let projectedBytes = usedBytes;
		let projectedCount = documents.length;
		const accepted: File[] = [];
		// Skip files whose name already exists (case-insensitive), including duplicates
		// within the same batch — matched names are added as they are accepted.
		const seenNames = new Set(documents.map((document) => document.name.toLowerCase()));

		for (const file of fileList) {
			if (file.type !== "application/pdf") {
				toast.error(t("Workspace.fileTypeError"));
				continue;
			}
			if (seenNames.has(file.name.toLowerCase())) {
				toast.error(t("Workspace.duplicateFile", { name: file.name }));
				continue;
			}
			if (limits.maxFileSize !== null && file.size > limits.maxFileSize) {
				const maxFileSizeMb = Math.round(limits.maxFileSize / (1024 * 1024));
				toast.error(t("Workspace.fileSizeError", { size: maxFileSizeMb }));
				continue;
			}
			if (limits.maxFiles !== null && projectedCount >= limits.maxFiles) {
				toast.error(t("Workspace.uploadLimitReached"));
				break;
			}
			if (projectedBytes + file.size > limits.storageLimit) {
				toast.error(t("Workspace.storageError", { size: formatStorage(limits.storageLimit) }));
				break;
			}
			accepted.push(file);
			seenNames.add(file.name.toLowerCase());
			projectedBytes += file.size;
			projectedCount += 1;
		}

		if (!accepted.length) return;

		startUpload(async () => {
			const documentIds: string[] = [];
			for (const file of accepted) {
				const documentId = await uploadOne(file);
				if (documentId) documentIds.push(documentId);
			}
			router.refresh();
			if (documentIds.length) {
				toast.success(t("Workspace.uploadQueued"));
				documentIds.forEach(runIngestion);
			}
		});
	};

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
		// Removing the last document leaves the "all documents" thread orphaned — it
		// has no document/folder FK to cascade on — so it would resurface (with old
		// messages) on the next upload. Clear it here so a fresh upload starts empty.
		const isLastDocument = documents.length === 1;
		startRemove(async () => {
			const result = await removeDocument(id);
			if (result?.error) {
				toast.error(result.error);
				return;
			}
			if (isLastDocument) {
				await clearChatMessages({ documentId: null, folderId: null });
			}
			if (scope.documentId === id) onSelectAll();
			router.refresh();
			toast.success(t("Workspace.removeSuccess"));
		});
	};

	const renderDocument = (document: DocumentRow) => (
		<DocumentListItem
			key={document.id}
			document={document}
			folders={folders}
			isActive={scope.documentId === document.id}
			onSelect={() => onSelectDocument(document.id)}
			onReingest={() => handleReingest(document.id)}
			onRemove={() => handleRemove(document.id)}
			isReingesting={isReingesting}
			isRemoving={isRemoving}
		/>
	);

	return (
		<aside
			className={cn(
				"flex min-h-0 flex-col gap-4 rounded-2xl border border-border bg-background p-4 shadow-sm",
				className,
			)}
		>
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<h2 className="text-sm font-medium text-foreground/80">
						{t("Workspace.documentsTitle")}
					</h2>
					{documents.length > 0 && (
						<span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60">
							{documents.length}
						</span>
					)}
				</div>
				<NewFolderButton />
			</div>

			<label
				onDragOver={(event) => {
					event.preventDefault();
					setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setIsDragging(false);
					const files = Array.from(event.dataTransfer.files ?? []);
					if (files.length) handleFiles(files);
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
					multiple
					className="sr-only"
					disabled={isUploading || isBlocked}
					onChange={(event) => {
						const files = Array.from(event.target.files ?? []);
						if (files.length) handleFiles(files);
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

			{loadError ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-foreground/50">
					<HugeiconsIcon icon={InformationCircleIcon} className="size-6 text-destructive/70" />
					<p className="text-xs">{t("Workspace.documentsLoadError")}</p>
					<Button variant="outline" size="sm" onClick={() => router.refresh()}>
						{t("Workspace.documentsLoadRetry")}
					</Button>
				</div>
			) : documents.length === 0 && folders.length === 0 ? (
				<div className="flex flex-1 flex-col items-center justify-center gap-2 text-center text-foreground/40">
					<HugeiconsIcon icon={DocumentIcon} className="size-6" />
					<p className="text-xs">{t("Workspace.documentsEmpty")}</p>
				</div>
			) : (
				<ul className="-mx-1 flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto [mask-image:linear-gradient(to_bottom,black_calc(100%-1rem),transparent)] px-1 pb-4">
					<li>
						<div
							role="button"
							tabIndex={0}
							onClick={onSelectAll}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									onSelectAll();
								}
							}}
							className={cn(
								"flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
								isAllActive
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

					{folders.map((folder) => {
						const folderDocuments = documents.filter(
							(document) => document.folder_id === folder.id,
						);
						return (
							<FolderGroup
								key={folder.id}
								folder={folder}
								isActive={scope.folderId === folder.id}
								count={folderDocuments.length}
								onSelect={() => onSelectFolder(folder.id)}
							>
								{folderDocuments.length > 0 ? (
									folderDocuments.map(renderDocument)
								) : (
									<li className="px-3 py-1.5 text-xs text-foreground/40">
										{t("Folders.emptyFolder")}
									</li>
								)}
							</FolderGroup>
						);
					})}

					{folders.length > 0 && unfiledDocuments.length > 0 && (
						<li className="px-2 pt-2 text-xs font-medium text-foreground/40">
							{t("Folders.unfiled")}
						</li>
					)}
					{unfiledDocuments.map(renderDocument)}
				</ul>
			)}

			{documents.length > 0 && isAllActive && (
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
