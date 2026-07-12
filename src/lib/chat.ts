import type { UIMessage } from "ai";

export type Source = {
	documentId: string;
	name: string;
	page: number | null;
	// Full text of every retrieved chunk on this (document, page) — powers PDF highlight (RM-1).
	snippets: string[];
};

export type ChatMessage = UIMessage<never, { sources: Source[] }>;
