"use client";

import { useState } from "react";
import { ChatZone, FilePreview, UploadZone } from "@/components/workspace";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { DocumentRow } from "@/lib/documents";

interface PreviewContainerProps {
  userId: string;
  documents: DocumentRow[];
}

type Tab = "documents" | "preview" | "chat";

export function PreviewContainer({ userId, documents }: PreviewContainerProps) {
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

  // Clicking a source chip opens that document at the cited page.
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
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-xl px-3 py-1.5 text-sm font-medium transition-colors",
              tab === item.id
                ? "bg-primary text-primary-foreground"
                : "text-foreground/60 hover:bg-muted",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <UploadZone
        userId={userId}
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
        scopeName={scopeName}
        onSourceClick={handleSourceClick}
        className={cn(tab === "chat" ? "flex" : "hidden", "md:flex")}
      />
    </>
  );
}
