import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
	user: null as { id: string } | null,
	supabase: null as unknown,
	writes: [] as { type: string; data?: unknown }[],
	embedInputs: [] as string[][],
	executePromise: null as Promise<void> | null,
}));

vi.mock("@/features/auth/service", () => ({
	getCurrentUser: async () => state.user,
}));

vi.mock("@/shared/config/supabase/server", () => ({
	createClient: async () => state.supabase,
}));

vi.mock("@/features/documents/lib/embedding", () => ({
	embedChunks: async (texts: string[]) => {
		state.embedInputs.push(texts);
		return [[0.1, 0.2, 0.3]];
	},
}));

vi.mock("@ai-sdk/openai", () => ({
	openai: () => "model",
}));

vi.mock("next/server", () => ({
	after: () => {},
}));

vi.mock("ai", () => ({
	convertToModelMessages: async () => [],
	streamText: () => ({ toUIMessageStream: () => ({}) }),
	createUIMessageStream: (options: { execute: (arg: { writer: unknown }) => Promise<void> }) => {
		const writer = {
			write: (part: { type: string; data?: unknown }) => state.writes.push(part),
			merge: () => {},
		};
		state.executePromise = options.execute({ writer });
		return { __uiStream: true };
	},
	createUIMessageStreamResponse: () => new Response(null, { status: 200 }),
}));

import { POST } from "./route";

type SupabaseConfig = {
	rate?: boolean;
	rateError?: { message: string } | null;
	plan?: string | null;
	usage?: { tokens_used: number; requests_used: number };
	match?: unknown[];
	matchError?: { message: string } | null;
	fallbackChunks?: unknown[];
	fallbackError?: { message: string } | null;
	onMatchChunks?: (args: Record<string, unknown>) => void;
};

function makeSupabase(config: SupabaseConfig) {
	const {
		rate = true,
		rateError = null,
		plan = "guest",
		usage = { tokens_used: 0, requests_used: 0 },
		match = [],
		matchError = null,
		fallbackChunks = [],
		fallbackError = null,
		onMatchChunks,
	} = config;

	return {
		rpc: (name: string, args?: Record<string, unknown>) => {
			if (name === "check_chat_rate") return { data: rate, error: rateError };
			if (name === "get_usage") return { data: [usage], error: null };
			if (name === "match_chunks") {
				onMatchChunks?.(args ?? {});
				return { data: match, error: matchError };
			}
			return { data: null, error: null };
		},
		from: (table: string) => {
			if (table === "profiles") {
				return {
					select: () => ({
						eq: () => ({ single: async () => ({ data: { plan }, error: null }) }),
					}),
				};
			}

			const fallbackQuery = {
				select: () => fallbackQuery,
				order: () => fallbackQuery,
				limit: () => fallbackQuery,
				in: () => fallbackQuery,
				insert: async () => ({ data: null, error: null }),
				then: (
					resolve: (value: { data: unknown[]; error: { message: string } | null }) => unknown,
				) => Promise.resolve({ data: fallbackChunks, error: fallbackError }).then(resolve),
			};
			return fallbackQuery;
		},
	};
}

function chatRequest(body: unknown = { messages: [], documentIds: [] }): Request {
	return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
	state.user = { id: "user-1" };
	state.supabase = makeSupabase({});
	state.writes = [];
	state.embedInputs = [];
	state.executePromise = null;
});

describe("POST /api/chat — guards", () => {
	it("returns 401 when there is no signed-in user", async () => {
		state.user = null;
		const response = await POST(chatRequest());
		expect(response.status).toBe(401);
	});

	it("returns 500 when the rate-limit RPC errors", async () => {
		state.supabase = makeSupabase({ rateError: { message: "boom" } });
		const response = await POST(chatRequest());
		expect(response.status).toBe(500);
	});

	it("returns 429 when the burst rate limit is exceeded", async () => {
		state.supabase = makeSupabase({ rate: false });
		const response = await POST(chatRequest());
		expect(response.status).toBe(429);
		expect(await response.text()).toMatch(/slow down/i);
	});

	it("returns 429 when the plan request cap is reached", async () => {
		state.supabase = makeSupabase({
			plan: "guest",
			usage: { tokens_used: 0, requests_used: 15 },
		});
		const response = await POST(chatRequest());
		expect(response.status).toBe(429);
		expect(await response.text()).toMatch(/request limit/i);
	});

	it("returns 429 when the plan token budget is reached", async () => {
		state.supabase = makeSupabase({
			plan: "free",
			usage: { tokens_used: 500_000, requests_used: 0 },
		});
		const response = await POST(chatRequest());
		expect(response.status).toBe(429);
		expect(await response.text()).toMatch(/token budget/i);
	});

	it("returns 500 when the vector search RPC errors", async () => {
		state.supabase = makeSupabase({ matchError: { message: "search failed" } });
		const response = await POST(
			chatRequest({ messages: [{ parts: [{ type: "text", text: "hi" }] }], documentIds: [] }),
		);
		expect(response.status).toBe(500);
	});

	it("returns 400 when the question is empty", async () => {
		const response = await POST(chatRequest({ messages: [], documentIds: [] }));

		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/question is required/i);
		expect(state.embedInputs).toEqual([]);
	});
});

describe("POST /api/chat — happy path", () => {
	it("streams a 200 response and dedupes sources by document + page", async () => {
		let matchArgs: Record<string, unknown> | undefined;
		state.supabase = makeSupabase({
			onMatchChunks: (args) => {
				matchArgs = args;
			},
			match: [
				{ document_id: "doc-1", name: "Policy.pdf", content: "a", page: 1, similarity: 0.9 },
				{ document_id: "doc-1", name: "Policy.pdf", content: "b", page: 1, similarity: 0.8 },
				{ document_id: "doc-2", name: "Handbook.pdf", content: "c", page: 4, similarity: 0.7 },
			],
		});

		const response = await POST(
			chatRequest({
				messages: [{ parts: [{ type: "text", text: "What is the policy?" }] }],
				documentIds: ["doc-1", "doc-2"],
			}),
		);
		await state.executePromise;

		expect(response.status).toBe(200);
		expect(matchArgs).toMatchObject({ match_count: 12, match_threshold: 0.12 });
		const sourcesPart = state.writes.find((part) => part.type === "data-sources");
		expect(sourcesPart?.data).toEqual([
			{ documentId: "doc-1", name: "Policy.pdf", page: 1 },
			{ documentId: "doc-2", name: "Handbook.pdf", page: 4 },
		]);
	});

	it("falls back to leading document chunks when vector search finds no matches", async () => {
		state.supabase = makeSupabase({
			match: [],
			fallbackChunks: [
				{
					document_id: "doc-1",
					content: "Executive summary",
					page: 1,
					documents: { name: "Overview.pdf" },
				},
			],
		});

		const response = await POST(
			chatRequest({
				messages: [{ parts: [{ type: "text", text: "What is this document about?" }] }],
				documentIds: ["doc-1"],
			}),
		);
		await state.executePromise;

		expect(response.status).toBe(200);
		const sourcesPart = state.writes.find((part) => part.type === "data-sources");
		expect(sourcesPart?.data).toEqual([{ documentId: "doc-1", name: "Overview.pdf", page: 1 }]);
	});
});
