"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/shared/config/i18n";
import { cn } from "@/shared/lib/utils";
import type { Source } from "@/features/chat/types";

type SourceGroup = { documentId: string; name: string; pages: (number | null)[] };

function groupSources(sources: Source[]): SourceGroup[] {
	const byDocument = new Map<string, SourceGroup>();
	for (const source of sources) {
		const group = byDocument.get(source.documentId);
		if (group) {
			if (!group.pages.includes(source.page)) group.pages.push(source.page);
		} else {
			byDocument.set(source.documentId, {
				documentId: source.documentId,
				name: source.name,
				pages: [source.page],
			});
		}
	}
	return [...byDocument.values()];
}

export function SourceChips({
	sources,
	onSelect,
}: {
	sources: Source[];
	onSelect: (documentId: string, page: number | null) => void;
}) {
	const t = useT();
	const [openDocumentId, setOpenDocumentId] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const groups = groupSources(sources);

	useEffect(() => {
		if (!openDocumentId) return;
		const handleOutsideClick = (event: MouseEvent) => {
			if (!containerRef.current?.contains(event.target as Node)) setOpenDocumentId(null);
		};
		document.addEventListener("mousedown", handleOutsideClick);
		return () => document.removeEventListener("mousedown", handleOutsideClick);
	}, [openDocumentId]);

	const pageLabel = (page: number | null) => (page ? t("workspace.sourcePage", { page }) : "");

	const chipClass =
		"rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground/60 transition-colors hover:border-primary hover:text-foreground";

	return (
		<div ref={containerRef} className="flex flex-wrap gap-1 px-1">
			{groups.map((group) => {
				const [primaryPage, ...extraPages] = group.pages;
				const isOpen = openDocumentId === group.documentId;
				return (
					<div key={group.documentId} className="relative flex items-center">
						<button
							type="button"
							onClick={() => onSelect(group.documentId, primaryPage)}
							className={chipClass}
						>
							{group.name}
							{primaryPage ? ` · ${pageLabel(primaryPage)}` : ""}
						</button>
						{extraPages.length > 0 && (
							<>
								<button
									type="button"
									aria-label={t("workspace.morePagesLabel")}
									aria-expanded={isOpen}
									onClick={() => setOpenDocumentId(isOpen ? null : group.documentId)}
									className={cn(chipClass, "ms-1")}
								>
									{t("workspace.morePages", { count: extraPages.length })}
								</button>
								{isOpen && (
									<div className="absolute start-0 top-full z-10 mt-1 flex min-w-[7rem] flex-col gap-0.5 rounded-lg border border-border bg-background p-1 shadow-md">
										{extraPages.map((page) => (
											<button
												key={String(page)}
												type="button"
												onClick={() => {
													onSelect(group.documentId, page);
													setOpenDocumentId(null);
												}}
												className="rounded-md px-2 py-1 text-start text-xs text-foreground/70 transition-colors hover:bg-muted"
											>
												{pageLabel(page)}
											</button>
										))}
									</div>
								)}
							</>
						)}
					</div>
				);
			})}
		</div>
	);
}
