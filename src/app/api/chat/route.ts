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

	// унікальні джерела (файл + сторінка)
	const seen = new Set<string>();
	const sources: Source[] = [];
	for (const c of chunks) {
		const key = `${c.document_id}:${c.page}`;
		if (!seen.has(key)) {
			seen.add(key);
			sources.push({ documentId: c.document_id, name: c.name, page: c.page });
		}
	}

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
