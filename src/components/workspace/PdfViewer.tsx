"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { useT } from "@/i18n";

// Self-hosted worker; version must match react-pdf's bundled pdfjs-dist.
// This module is only ever loaded on the client (via next/dynamic ssr:false),
// so touching pdfjs globals here never runs on the server.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

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

interface PdfViewerProps {
	url: string;
	page?: number | null;
	label?: string;
}

export function PdfViewer({ url, page, label }: PdfViewerProps) {
	const t = useT();
	const [numPages, setNumPages] = useState(0);
	const [width, setWidth] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

	// Track container width so pages render at the right size.
	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	// Jump to the cited page once the document is rendered.
	useEffect(() => {
		if (!numPages || !page) return;
		const id = requestAnimationFrame(() => {
			pageRefs.current[page - 1]?.scrollIntoView({ block: "start" });
		});
		return () => cancelAnimationFrame(id);
	}, [numPages, page]);

	return (
		<div ref={containerRef} aria-label={label} className="h-full w-full overflow-auto">
			<Document
				file={url}
				onLoadSuccess={({ numPages }) => setNumPages(numPages)}
				loading={<Spinner />}
				error={
					<div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
						{t("Workspace.previewError")}
					</div>
				}
				className="flex flex-col items-center gap-4 py-4"
			>
				{width > 0 &&
					Array.from({ length: numPages }, (_, i) => (
						<div
							key={i}
							ref={(el) => {
								pageRefs.current[i] = el;
							}}
							className="shadow-sm"
						>
							<Page
								pageNumber={i + 1}
								width={Math.min(width - 16, 900)}
								renderAnnotationLayer={false}
							/>
						</div>
					))}
			</Document>
		</div>
	);
}
