"use client";

import { useState } from "react";
import { ChatZone } from "@/features/chat/components/ChatZone";
import { FilePreview } from "@/features/documents/components/FilePreview";
import { UploadZone } from "@/features/documents/components/UploadZone";
import { cn } from "@/shared/lib/utils";
import { useT } from "@/shared/config/i18n";
import type { DocumentRow } from "@/features/documents/service";
import type { PlanUsage } from "@/features/billing/service";
import type { ChatMessage } from "@/features/chat/types";
import { Button } from "@/shared/ui/button";

interface PreviewContainerProps {
	userId: string;
	plan: string;
	usage: PlanUsage;
	documents: DocumentRow[];
	initialMessages: ChatMessage[];
}

type Tab = "documents" | "preview" | "chat";

export function PreviewContainer({
	userId,
	plan,
	usage,
	documents,
	initialMessages,
}: PreviewContainerProps) {
	const t = useT();
	const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
	const [selectedPage, setSelectedPage] = useState<number | null>(null);
	const [tab, setTab] = useState<Tab>("documents");
	const selectedDoc = documents.find((doc) => doc.id === selectedDocId) ?? null;
	const scopeName = selectedDoc?.name ?? t("Workspace.allDocuments");

	const handleSelectDocument = (id: string | null) => {
		setSelectedDocId(id);
		setSelectedPage(null);
		if (id) setTab("preview");
	};

	const handleSourceClick = (documentId: string, page: number | null) => {
		setSelectedDocId(documentId);
		setSelectedPage(page);
		setTab("preview");
	};

	const tabs: { id: Tab; label: string }[] = [
		{ id: "documents", label: t("Workspace.documentsTitle") },
		{ id: "preview", label: t("Workspace.previewTab") },
		{ id: "chat", label: t("Workspace.chatTab") },
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
				selectedDocId={selectedDocId}
				handleSelectDocument={handleSelectDocument}
				className={cn(tab === "documents" ? "flex" : "hidden", "md:flex")}
			/>

			<div
				className={cn(
					tab === "preview" ? "block" : "hidden",
					"min-h-0 overflow-hidden rounded-2xl border border-border bg-muted/30 shadow-sm md:block",
				)}
			>
				<FilePreview documentId={selectedDocId} name={selectedDoc?.name} page={selectedPage} />
			</div>

			<ChatZone
				documentId={selectedDocId}
				plan={plan}
				usage={usage}
				scopeName={scopeName}
				initialMessages={initialMessages}
				onSourceClick={handleSourceClick}
				className={cn(tab === "chat" ? "flex" : "hidden", "md:flex")}
			/>
		</>
	);
}
