import { openai } from "@ai-sdk/openai";
import {
	streamText,
	convertToModelMessages,
	createUIMessageStream,
	createUIMessageStreamResponse,
} from "ai";
import { after } from "next/server";
import { createClient } from "@/shared/config/supabase/server";
import { embedChunks } from "@/features/documents/lib/embedding";
import { getPlanLimits } from "@/features/billing/service";
import type { ChatMessage, Source } from "@/features/chat/types";
import { getCurrentUser } from "@/features/auth/service";

export const maxDuration = 30;

// Per-user burst limit for chat: at most RATE_LIMIT_MAX requests per
// RATE_LIMIT_WINDOW_SECONDS, enforced in the DB (see prisma/sql/rateLimitSetup.sql).
// This sits on top of the cumulative plan caps below (get_usage / plan budget).
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_SECONDS = 60;
const MATCH_COUNT = 12;
const MATCH_THRESHOLD = 0.12;

type Matched = {
	document_id: string;
	name: string;
	content: string;
	page: number | null;
	similarity: number;
};

type FallbackChunk = {
	document_id: string;
	content: string;
	page: number | null;
	documents: { name: string } | { name: string }[] | null;
};

function getDocumentName(documents: FallbackChunk["documents"]) {
	if (Array.isArray(documents)) return documents[0]?.name ?? "Document";
	return documents?.name ?? "Document";
}

async function getFallbackChunks(
	supabase: Awaited<ReturnType<typeof createClient>>,
	documentIds: string[] | undefined,
): Promise<Matched[]> {
	let query = supabase
		.from("chunks")
		.select("document_id, content, page, documents(name)")
		.order("document_id", { ascending: true })
		.order("chunk_index", { ascending: true })
		.limit(MATCH_COUNT);

	if (documentIds?.length) {
		query = query.in("document_id", documentIds);
	}

	const { data, error } = await query;
	if (error) throw new Error(error.message);

	return ((data as FallbackChunk[] | null) ?? []).map((chunk) => ({
		document_id: chunk.document_id,
		name: getDocumentName(chunk.documents),
		content: chunk.content,
		page: chunk.page,
		similarity: 0,
	}));
}

export async function POST(req: Request) {
	const supabase = await createClient();
	const user = await getCurrentUser();
	if (!user) return new Response("Unauthorized", { status: 401 });

	const { data: rateAllowed, error: rateError } = await supabase.rpc("check_chat_rate", {
		p_max: RATE_LIMIT_MAX,
		p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
	});
	if (rateError) return new Response(rateError.message, { status: 500 });
	if (!rateAllowed) return new Response("Too many requests. Please slow down.", { status: 429 });

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
	if (!question) return new Response("Question is required.", { status: 400 });

	const [queryEmbedding] = await embedChunks([question]);

	const { data, error } = await supabase.rpc("match_chunks", {
		query_embedding: queryEmbedding,
		match_count: MATCH_COUNT,
		match_threshold: MATCH_THRESHOLD,
		document_ids: documentIds?.length ? documentIds : null,
	});
	if (error) return new Response(error.message, { status: 500 });

	let chunks = (data as Matched[]) ?? [];
	if (!chunks.length) {
		try {
			chunks = await getFallbackChunks(supabase, documentIds);
		} catch (error) {
			return new Response(error instanceof Error ? error.message : "Fallback search failed", {
				status: 500,
			});
		}
	}

	const sourcesByKey = new Map<string, Source>();
	for (const chunk of chunks) {
		const key = `${chunk.document_id}:${chunk.page}`;
		if (!sourcesByKey.has(key)) {
			sourcesByKey.set(key, {
				documentId: chunk.document_id,
				name: chunk.name,
				page: chunk.page,
			});
		}
	}
	const sources: Source[] = [...sourcesByKey.values()];

	const context = chunks
		.map((c, i) => `[#${i + 1} ${c.name}${c.page ? `, p.${c.page}` : ""}]\n${c.content}`)
		.join("\n\n");

	const instructions = [
		"You answer questions using ONLY the context below.",
		"Answer in the same language as the user's question.",
		"Synthesize across all relevant context chunks; do not require the answer to appear as one exact phrase.",
		"For resumes/CVs, questions about employers, roles, education, skills, or timelines should be answered from the listed experience and profile details when present.",
		"If the answer is not supported by the context, say you don't know — never invent facts.",
		"",
		"Context:",
		context || "(no relevant context found)",
	].join("\n");

	// Meter the chat cost (prompt + completion tokens) against the plan budget. The DB
	// write runs in an after() hook — not inline in onFinish — because onFinish fires as
	// the stream closes, and the serverless function could otherwise be torn down before
	// the RPC lands, so the counter never moved (TD-19). after() keeps the function alive
	// until the write completes. Embedding tokens aren't counted — they're negligible.
	let resolveTokens!: (tokens: number) => void;
	const tokensUsed = new Promise<number>((resolve) => {
		resolveTokens = resolve;
	});

	after(async () => {
		const tokens = await tokensUsed;
		const { error: meterError } = await supabase.rpc("increment_usage", { p_tokens: tokens });
		if (meterError) console.error("increment_usage failed:", meterError.message);
	});

	const stream = createUIMessageStream<ChatMessage>({
		execute: async ({ writer }) => {
			// Send the sources as a data-part; the id routes it into message.parts on the client.
			writer.write({ type: "data-sources", id: "sources", data: sources });

			const result = streamText({
				model: openai("gpt-4o-mini"),
				instructions,
				messages: await convertToModelMessages(messages),
				onFinish: ({ totalUsage }) => {
					resolveTokens(
						totalUsage?.totalTokens ??
							(totalUsage?.inputTokens ?? 0) + (totalUsage?.outputTokens ?? 0),
					);
				},
				// Still settle the meter (with 0) if the model call errors, so after() never hangs.
				onError: () => resolveTokens(0),
			});
			writer.merge(result.toUIMessageStream());
		},
	});

	return createUIMessageStreamResponse({ stream });
}
