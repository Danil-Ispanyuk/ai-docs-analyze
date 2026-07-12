"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useT } from "@/shared/config/i18n";
import { getDocumentUrl } from "@/features/documents/actions";
import { HugeiconsIcon } from "@hugeicons/react";
import { DocumentIcon } from "@/shared/assets/icons";

function Spinner() {
	return (
		<div className="flex h-full items-center justify-center">
			<span
				className="size-5 animate-spin rounded-full border-2 border-current border-t-transparent text-foreground/40"
				aria-hidden
			/>
		</div>
	);
}

const PdfViewer = dynamic(() => import("./PdfViewer").then((m) => m.PdfViewer), {
	ssr: false,
	loading: () => <Spinner />,
});

interface FilePreviewProps {
	documentId: string | null;
	name?: string;
	page?: number | null;
	highlights?: string[];
}

type PreviewState = { id: string; url?: string; error?: string };

export function FilePreview({ documentId, name, page, highlights }: FilePreviewProps) {
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
			highlights={highlights}
			label={name ?? t("Workspace.previewTitle")}
		/>
	);
}
