"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/shared/config/i18n";
import { getDocumentUrl } from "@/features/documents/actions";
import { Spinner } from "@/shared/components/Spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { DocumentIcon } from "@/shared/assets/icons";

const PdfViewer = dynamic(() => import("./PdfViewer").then((m) => m.PdfViewer), {
	ssr: false,
	loading: () => <Spinner />,
});

interface FilePreviewProps {
	documentId: string | null;
	name?: string;
	page?: number | null;
}

type PreviewState = { id: string; url?: string; error?: string };

// Signed URLs expire; if the viewer fails to load one, re-sign once before giving up.
const MAX_URL_RETRIES = 1;

export function FilePreview({ documentId, name, page }: FilePreviewProps) {
	const t = useT();
	const [result, setResult] = useState<PreviewState | null>(null);
	const retriesRef = useRef(0);

	useEffect(() => {
		if (!documentId) return;

		let active = true;
		retriesRef.current = 0;
		getDocumentUrl(documentId).then((res) => {
			if (active) setResult({ id: documentId, url: res.url, error: res.error });
		});

		return () => {
			active = false;
		};
	}, [documentId]);

	// Re-sign the URL when the viewer reports a load error (most often a silent expiry).
	const handleLoadError = () => {
		if (!documentId || retriesRef.current >= MAX_URL_RETRIES) return;
		retriesRef.current += 1;
		getDocumentUrl(documentId).then((res) => {
			setResult({ id: documentId, url: res.url, error: res.error });
		});
	};

	if (!documentId) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-foreground/40">
				<HugeiconsIcon icon={DocumentIcon} className="size-8" />
				<p className="text-sm">{t("Workspace.previewEmpty")}</p>
			</div>
		);
	}

	if (result?.id !== documentId) return <Spinner />;

	if (result.error) {
		return (
			<div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
				{result.error}
			</div>
		);
	}

	if (!result.url) return null;

	return (
		<PdfViewer
			key={result.url}
			url={result.url}
			page={page}
			label={name ?? t("Workspace.previewTitle")}
			onLoadError={handleLoadError}
		/>
	);
}
