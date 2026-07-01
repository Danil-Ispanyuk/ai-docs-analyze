"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { getDocumentUrl } from "@/actions/documents";
import { DocumentIcon } from "./icons";

interface FilePreviewProps {
  documentId: string | null;
  name?: string;
  page?: number | null;
}

type PreviewState = { id: string; url?: string; error?: string };

export function FilePreview({ documentId, name, page }: FilePreviewProps) {
  const t = useT();
  const [result, setResult] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!documentId) return;

    let active = true;
    getDocumentUrl(documentId).then((res) => {
      if (active) setResult({ id: documentId, url: res.url, error: res.error });
    });

    return () => {
      active = false;
    };
  }, [documentId]);

  if (!documentId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-foreground/40">
        <DocumentIcon className="size-8" />
        <p className="text-sm">{t("Workspace.previewEmpty")}</p>
      </div>
    );
  }

  if (result?.id !== documentId) {
    return (
      <div className="flex h-full items-center justify-center">
        <span
          className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent text-foreground/40"
          aria-hidden
        />
      </div>
    );
  }

  if (result.error) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
        {result.error}
      </div>
    );
  }

  if (!result.url) return null;

  return (
    <iframe
      key={`${documentId}-${page ?? 1}`}
      src={`${result.url}#page=${page ?? 1}&toolbar=0&navpanes=0&view=FitH`}
      title={name ?? t("Workspace.previewTitle")}
      className="h-full w-full border-0"
    />
  );
}
