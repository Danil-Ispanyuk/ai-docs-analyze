import type { UIMessage } from "ai";

export type Source = {
	documentId: string;
	name: string;
	page: number | null;
};

export type ChatMessage = UIMessage<{ tokens?: number }, { sources: Source[] }>;

// The scope of a chat thread (RM-7), orthogonal: at most one of documentId /
// folderId is set. Both null = the "all documents" thread.
export type ChatScope = {
	documentId: string | null;
	folderId: string | null;
};
