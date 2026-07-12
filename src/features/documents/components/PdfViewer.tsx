"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { useT } from "@/shared/config/i18n";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

// Translucent box painted over the (transparent) text layer to mark a cited chunk (RM-1).
const HIGHLIGHT_MARK_CLASS = "rounded-[2px] bg-yellow-300/45 dark:bg-yellow-400/30";

// Text-layer items shorter than this after normalization are skipped to avoid marking
// stray single characters / punctuation that trivially appear inside any chunk.
const MIN_MATCH_LENGTH = 2;

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

function normalizeWhitespace(value: string) {
	return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function escapeHtml(value: string) {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

interface PdfViewerProps {
	url: string;
	page?: number | null;
	highlights?: string[];
	label?: string;
}

export function PdfViewer({ url, page, highlights, label }: PdfViewerProps) {
	const t = useT();
	const [numPages, setNumPages] = useState(0);
	const [width, setWidth] = useState(0);
	const containerRef = useRef<HTMLDivElement>(null);
	const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
	const pendingHighlightScrollRef = useRef(false);

	// Retrieved chunk texts for the cited page, normalized once per citation.
	const normalizedHighlights = useMemo(
		() => (highlights ?? []).map(normalizeWhitespace).filter(Boolean),
		[highlights],
	);
	const hasHighlights = normalizedHighlights.length > 0;

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	// Jump to the cited page. When there are highlights, arm the mark-scroll that runs once
	// the cited page's text layer has rendered (see handleCitedTextLayerRender).
	useEffect(() => {
		if (!numPages || !page) return;
		if (hasHighlights) pendingHighlightScrollRef.current = true;
		const frame = requestAnimationFrame(() => {
			pageRefs.current[page - 1]?.scrollIntoView({ block: "start" });
		});
		return () => cancelAnimationFrame(frame);
	}, [numPages, page, hasHighlights, highlights]);

	// Best-effort: wrap any text run that falls inside a retrieved chunk in <mark>.
	const renderHighlightedText = useCallback(
		({ str }: { str: string }) => {
			const escaped = escapeHtml(str);
			const needle = normalizeWhitespace(str);
			if (needle.length < MIN_MATCH_LENGTH) return escaped;
			const matched = normalizedHighlights.some((snippet) => snippet.includes(needle));
			return matched ? `<mark class="${HIGHLIGHT_MARK_CLASS}">${escaped}</mark>` : escaped;
		},
		[normalizedHighlights],
	);

	// Once the cited page's marks exist in the DOM, center the first one; if nothing matched,
	// the plain page-top jump above already stands in as the fallback.
	const handleCitedTextLayerRender = useCallback(() => {
		if (!pendingHighlightScrollRef.current || !page) return;
		pendingHighlightScrollRef.current = false;
		const pageElement = pageRefs.current[page - 1];
		const firstMark = pageElement?.querySelector("mark");
		if (firstMark) firstMark.scrollIntoView({ block: "center", behavior: "smooth" });
		else pageElement?.scrollIntoView({ block: "start" });
	}, [page]);

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
					Array.from({ length: numPages }, (_, index) => {
						const isCitedPage = page === index + 1;
						return (
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
									customTextRenderer={
										isCitedPage && hasHighlights ? renderHighlightedText : undefined
									}
									onRenderTextLayerSuccess={isCitedPage ? handleCitedTextLayerRender : undefined}
								/>
							</div>
						);
					})}
			</Document>
		</div>
	);
}
