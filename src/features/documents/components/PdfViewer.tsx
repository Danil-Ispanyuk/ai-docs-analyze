"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import { Spinner } from "@/shared/components/Spinner";
import { PdfToolbar } from "./PdfToolbar";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
	"pdfjs-dist/build/pdf.worker.min.mjs",
	import.meta.url,
).toString();

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;
const BASE_MAX_WIDTH = 900;

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
	const [zoom, setZoom] = useState(1);
	const [currentPage, setCurrentPage] = useState(1);
	const [isExpanded, setIsExpanded] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
	const pendingPageRef = useRef<number | null>(null);
	const renderedPagesRef = useRef<Set<number>>(new Set());
	const visibleRatiosRef = useRef<Map<number, number>>(new Map());

	useEffect(() => {
		const element = containerRef.current;
		if (!element) return;
		const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const scrollToPendingIfReady = useCallback(() => {
		const target = pendingPageRef.current;
		if (!target) return;
		const element = pageRefs.current[target - 1];
		if (element && renderedPagesRef.current.has(target)) {
			element.scrollIntoView({ block: "start" });
			pendingPageRef.current = null;
		}
	}, []);

	useEffect(() => {
		if (!page) return;
		pendingPageRef.current = page;
		scrollToPendingIfReady();
	}, [page, scrollToPendingIfReady]);

	useEffect(() => {
		const root = containerRef.current;
		if (!root || !numPages || !width) return;
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const pageNumber = Number((entry.target as HTMLElement).dataset.page);
					visibleRatiosRef.current.set(pageNumber, entry.intersectionRatio);
				}
				let mostVisiblePage = currentPage;
				let bestRatio = 0;
				for (const [pageNumber, ratio] of visibleRatiosRef.current) {
					if (ratio > bestRatio) {
						bestRatio = ratio;
						mostVisiblePage = pageNumber;
					}
				}
				setCurrentPage(mostVisiblePage);
			},
			{ root, threshold: [0.1, 0.25, 0.5, 0.75, 1] },
		);
		pageRefs.current.forEach((element) => element && observer.observe(element));
		return () => observer.disconnect();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [numPages, width]);

	useEffect(() => {
		if (!isExpanded) return;
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") setIsExpanded(false);
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isExpanded]);

	const zoomIn = () => setZoom((value) => Math.min(MAX_ZOOM, value + ZOOM_STEP));
	const zoomOut = () => setZoom((value) => Math.max(MIN_ZOOM, value - ZOOM_STEP));

	const baseWidth = Math.min(width - 16, BASE_MAX_WIDTH);
	const pageWidth = Math.round(baseWidth * zoom);

	return (
		<div
			className={cn(
				"flex flex-col bg-muted/30",
				isExpanded ? "fixed inset-0 z-50 bg-background" : "h-full w-full",
			)}
		>
			{numPages > 0 && (
				<PdfToolbar
					currentPage={currentPage}
					numPages={numPages}
					canZoomIn={zoom < MAX_ZOOM}
					canZoomOut={zoom > MIN_ZOOM}
					isExpanded={isExpanded}
					onZoomIn={zoomIn}
					onZoomOut={zoomOut}
					onToggleExpand={() => setIsExpanded((value) => !value)}
				/>
			)}

			<div ref={containerRef} aria-label={label} className="min-h-0 flex-1 overflow-auto">
				<Document
					file={url}
					onLoadSuccess={({ numPages }) => setNumPages(numPages)}
					onLoadError={onLoadError}
					loading={<Spinner />}
					error={
						<div className="flex h-full items-center justify-center p-6 text-center text-sm text-destructive">
							{t("workspace.previewError")}
						</div>
					}
					className="py-4"
				>
					{baseWidth > 0 &&
						Array.from({ length: numPages }, (_, index) => (
							<div
								key={index}
								data-page={index + 1}
								ref={(element) => {
									pageRefs.current[index] = element;
								}}
								className="mx-auto mb-4 w-fit shadow-sm last:mb-0"
							>
								<Page
									pageNumber={index + 1}
									width={pageWidth}
									renderAnnotationLayer={false}
									onRenderSuccess={() => {
										renderedPagesRef.current.add(index + 1);
										scrollToPendingIfReady();
									}}
								/>
							</div>
						))}
				</Document>
			</div>
		</div>
	);
}
