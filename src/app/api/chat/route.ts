import { openai } from "@ai-sdk/openai";
import {
	streamText,
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
} from "ai";
import { createClient } from "@/shared/config/supabase/server";
import { embedChunks } from "@/features/documents/lib/embedding";
import { getPlanLimits } from "@/features/billing/service";
import type { ChatMessage, Source } from "@/features/chat/types";
import { getCurrentUser } from "@/features/auth/service";

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
	const user = await getCurrentUser();
	if (!user) return new Response("Unauthorized", { status: 401 });

	const { data: profile } = await supabase
		.from("profiles")
		.select("plan")
		.eq("id", user.id)
		.single();
	const limits = getPlanLimits(profile?.plan);

	const { data: usageRows } = await supabase.rpc("get_usage");
	const usage = usageRows?.[0] ?? { tokens_used: 0, requests_used: 0 };
	if (limits.requestCap !== null && usage.requests_used >= limits.requestCap) {
		return new Response("Request limit reached for your plan.", { status: 429 });
	}
	if (limits.tokenBudget !== null && usage.tokens_used >= limits.tokenBudget) {
		return new Response("Token budget reached for your plan.", { status: 429 });
	}

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
		query_embedding: queryEmbedding,
		match_count: 6,
		match_threshold: 0.2,
		document_ids: documentIds?.length ? documentIds : null,
	});
	if (error) return new Response(error.message, { status: 500 });

	const chunks = (data as Matched[]) ?? [];

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
				// Meter the chat cost (prompt + completion tokens) against the plan
				// budget. Embedding tokens aren't counted yet — they're negligible.
				onFinish: async ({ totalUsage }) => {
					const tokens =
						totalUsage?.totalTokens ??
						(totalUsage?.inputTokens ?? 0) + (totalUsage?.outputTokens ?? 0);
					await supabase.rpc("increment_usage", { p_tokens: tokens });
				},
			});
			writer.merge(result.toUIMessageStream());
		},
	});

	return createUIMessageStreamResponse({ stream });
}
