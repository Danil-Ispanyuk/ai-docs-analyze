"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { useT } from "@/shared/config/i18n";
import { Spinner } from "@/shared/components/Spinner";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

interface PdfViewerProps {
	url: string;
	page?: number | null;
	label?: string;
	onLoadError?: () => void;
}

export function PdfViewer({ url, page, label, onLoadError }: PdfViewerProps) {
	const t = useT();
	const [numPages, setNumPages] = useState(0);
	const [width, setWidth] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const pageRefs = useRef<(HTMLDivElement | null)[]>([]);

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// Jump to the cited page once the document has rendered.
	useEffect(() => {
		if (!numPages || !page) return;
		const frame = requestAnimationFrame(() => {
			pageRefs.current[page - 1]?.scrollIntoView({ block: "start" });
		});
		return () => cancelAnimationFrame(frame);
	}, [numPages, page]);

	return (
		<div ref={containerRef} aria-label={label} className="h-full w-full overflow-auto">
			<Document
				file={url}
				onLoadSuccess={({ numPages }) => setNumPages(numPages)}
				onLoadError={onLoadError}
				loading={<Spinner />}
				error={
					<div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
						{t("Workspace.previewError")}
					</div>
				}
				className="flex flex-col items-center gap-4 py-4"
			>
				{width > 0 &&
					Array.from({ length: numPages }, (_, index) => (
						<div
							key={index}
							ref={(element) => {
								pageRefs.current[index] = element;
							}}
							className="shadow-sm"
						>
							<Page
								pageNumber={index + 1}
								width={Math.min(width - 16, 900)}
								renderAnnotationLayer={false}
							/>
						</div>
					))}
			</Document>
		</div>
	);
}
