import { openai } from "@ai-sdk/openai";
import {
	streamText,
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
} from "ai";
import { createClient } from "@/lib/supabase/server";
import { embedChunks } from "@/lib/embedding";
import type { ChatMessage, Source } from "@/lib/chat";

export const maxDuration = 30;

type Matched = {
	document_id: string;
	name: string;
	content: string;
	page: number | null;
	similarity: number;
};

export async function POST(req: Request) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return new Response("Unauthorized", { status: 401 });

	const { messages, documentIds }: { messages: ChatMessage[]; documentIds?: string[] } =
		await req.json();

	const lastMessage = messages[messages.length - 1];
	const question =
		lastMessage?.parts
			?.map((p) => (p.type === "text" ? p.text : ""))
			.join("")
			.trim() ?? "";

	const [queryEmbedding] = await embedChunks([question]);

	const { data, error } = await supabase.rpc("match_chunks", {
		query_embedding: queryEmbedding, // якщо тип vector лається → JSON.stringify(...)
		match_count: 6,
		match_threshold: 0.2,
		document_ids: documentIds?.length ? documentIds : null,
	});
	if (error) return new Response(error.message, { status: 500 });

	const chunks = (data as Matched[]) ?? [];

	// групуємо джерела по (файл + сторінка), зберігаючи всі тексти чанків сторінки (RM-1: PDF highlight)
	const sourcesByKey = new Map<string, Source>();
	for (const chunk of chunks) {
		const key = `${chunk.document_id}:${chunk.page}`;
		const existing = sourcesByKey.get(key);
		if (existing) {
			existing.snippets.push(chunk.content);
		} else {
			sourcesByKey.set(key, {
				documentId: chunk.document_id,
				name: chunk.name,
				page: chunk.page,
				snippets: [chunk.content],
			});
		}
	}
	const sources: Source[] = [...sourcesByKey.values()];

	const context = chunks
		.map((c, i) => `[#${i + 1} ${c.name}${c.page ? `, p.${c.page}` : ""}]\n${c.content}`)
		.join("\n\n");

	const instructions = [
		"You answer questions using ONLY the context below.",
		"If the answer is not in the context, say you don't know — never invent facts.",
		"",
		"Context:",
		context || "(no relevant context found)",
	].join("\n");

	const stream = createUIMessageStream<ChatMessage>({
		execute: async ({ writer }) => {
			// джерела летять як data-part (id → потрапляє в message.parts на клієнті)
			writer.write({ type: "data-sources", id: "sources", data: sources });

			const result = streamText({
				model: openai("gpt-4o-mini"),
				instructions,
				messages: await convertToModelMessages(messages),
			});
			writer.merge(result.toUIMessageStream());
		},
	});

	return createUIMessageStreamResponse({ stream });
}
