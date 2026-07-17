import type { UIMessage } from "ai";

export type Source = {
	documentId: string;
	name: string;
	page: number | null;
};

export type ChatMessage = UIMessage<{ tokens?: number }, { sources: Source[] }>;

export type ChatScope = {
	documentId: string | null;
	folderId: string | null;
};
