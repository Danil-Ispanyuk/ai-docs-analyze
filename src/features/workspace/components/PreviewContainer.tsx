"use client";

import { useState } from "react";
import { ChatZone } from "@/features/chat/components/ChatZone";
import { FilePreview } from "@/features/documents/components/FilePreview";
import { UploadZone } from "@/features/documents/components/UploadZone";
import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/config/i18n";
import { DOCUMENT_STATUSES } from "@/shared/constants/general";
import type { DocumentRow } from "@/features/documents/service";
import type { FolderRow } from "@/features/folders/service";
import type { PlanUsage } from "@/features/billing/service";
import type { ChatMessage, ChatScope } from "@/features/chat/types";
import { Button } from "@/shared/ui/button";

interface PreviewContainerProps {
	userId: string;
	plan: string;
	usage: PlanUsage;
	documents: DocumentRow[];
	folders: FolderRow[];
	initialMessages: ChatMessage[];
	documentsLoadError?: boolean;
}

type Tab = "documents" | "preview" | "chat";

const ALL_SCOPE: ChatScope = { documentId: null, folderId: null };

export function PreviewContainer({
	userId,
	plan,
	usage,
	documents,
	folders,
	initialMessages,
	documentsLoadError = false,
}: PreviewContainerProps) {
	const t = useT();
	const [scope, setScope] = useState<ChatScope>(ALL_SCOPE);
	const [selectedPage, setSelectedPage] = useState<number | null>(null);
	const [tab, setTab] = useState<Tab>("documents");

	const documentExists =
		!scope.documentId || documents.some((document) => document.id === scope.documentId);
	const folderExists = !scope.folderId || folders.some((folder) => folder.id === scope.folderId);
	const effectiveScope: ChatScope = documentExists && folderExists ? scope : ALL_SCOPE;

	const selectedDoc =
		documents.find((document) => document.id === effectiveScope.documentId) ?? null;
	const selectedFolder = folders.find((folder) => folder.id === effectiveScope.folderId) ?? null;
	const scopeName = selectedDoc?.name ?? selectedFolder?.name ?? t("workspace.allDocuments");
	const chatDisabledReason =
		selectedDoc?.status === DOCUMENT_STATUSES.ERROR ? t("workspace.previewErroredBody") : null;

	const handleSelectAll = () => {
		setScope(ALL_SCOPE);
		setSelectedPage(null);
	};

	const handleSelectDocument = (id: string) => {
		setScope({ documentId: id, folderId: null });
		setSelectedPage(null);
		setTab("preview");
	};

	const handleSelectFolder = (id: string) => {
		setScope({ documentId: null, folderId: id });
		setSelectedPage(null);
		setTab("chat");
	};

	const handleSourceClick = (documentId: string, page: number | null) => {
		setScope({ documentId, folderId: null });
		setSelectedPage(page);
		setTab("preview");
	};

	const tabs: { id: Tab; label: string }[] = [
		{ id: "documents", label: t("workspace.documentsTitle") },
		{ id: "preview", label: t("workspace.previewTab") },
		{ id: "chat", label: t("workspace.chatTab") },
	];

	return (
		<>
			<div className="col-span-full grid grid-cols-3 gap-1 rounded-2xl border border-border bg-background p-1 md:hidden">
				{tabs.map((item) => (
					<Button
						variant="secondary"
						key={item.id}
						onClick={() => setTab(item.id)}
						className={cn(
							"rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
							tab === item.id
								? "bg-primary text-primary-foreground"
								: "text-foreground/60 hover:bg-muted",
						)}
					>
						{item.label}
					</Button>
				))}
			</div>

			<UploadZone
				userId={userId}
				plan={plan}
				documents={documents}
				folders={folders}
				scope={effectiveScope}
				loadError={documentsLoadError}
				onSelectAll={handleSelectAll}
				onSelectDocument={handleSelectDocument}
				onSelectFolder={handleSelectFolder}
				className={cn(tab === "documents" ? "flex" : "hidden", "md:flex")}
			/>

			<div
				className={cn(
					tab === "preview" ? "block" : "hidden",
					"min-h-0 overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-sm md:block",
				)}
			>
				<FilePreview
					documentId={effectiveScope.documentId}
					name={selectedDoc?.name}
					page={selectedPage}
					status={selectedDoc?.status}
				/>
			</div>

			<ChatZone
				key={documents.length > 0 ? "has-docs" : "empty"}
				scope={effectiveScope}
				plan={plan}
				usage={usage}
				scopeName={scopeName}
				initialMessages={initialMessages}
				onSourceClick={handleSourceClick}
				disabledReason={chatDisabledReason}
				className={cn(tab === "chat" ? "flex" : "hidden", "md:flex")}
			/>
		</>
	);
}
