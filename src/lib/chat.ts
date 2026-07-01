import type { UIMessage } from "ai";

export type Source = { documentId: string; name: string; page: number | null };

export type ChatMessage = UIMessage<never, { sources: Source[] }>;
