import { describe, it, expect, beforeEach, vi } from "vitest";

// Mutable per-test state reachable from the hoisted module mocks below.
const state = vi.hoisted(() => ({
	user: null as { id: string } | null,
	supabase: null as unknown,
	// Records everything written into the UI-message stream (e.g. the data-sources part).
	writes: [] as { type: string; data?: unknown }[],
	executePromise: null as Promise<void> | null,
}));

vi.mock("@/features/auth/service", () => ({
	getCurrentUser: async () => state.user,
}));

vi.mock("@/shared/config/supabase/server", () => ({
	createClient: async () => state.supabase,
}));

vi.mock("@/features/documents/lib/embedding", () => ({
	embedChunks: async () => [[0.1, 0.2, 0.3]],
}));

vi.mock("@ai-sdk/openai", () => ({
	openai: () => "model",
}));

vi.mock("next/server", () => ({
	// Swallow the metering hook so an unresolved token promise can't hang the test.
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
};

function makeSupabase(config: SupabaseConfig) {
	const {
		rate = true,
		rateError = null,
		plan = "guest",
		usage = { tokens_used: 0, requests_used: 0 },
		match = [],
		matchError = null,
	} = config;

	return {
		rpc: (name: string) => {
			if (name === "check_chat_rate") return { data: rate, error: rateError };
			if (name === "get_usage") return { data: [usage], error: null };
			if (name === "match_chunks") return { data: match, error: matchError };
			return { data: null, error: null };
		},
		from: () => ({
			select: () => ({
				eq: () => ({ single: async () => ({ data: { plan }, error: null }) }),
			}),
		}),
	};
}

function chatRequest(body: unknown = { messages: [], documentIds: [] }): Request {
	return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
	state.user = { id: "user-1" };
	state.supabase = makeSupabase({});
	state.writes = [];
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
		// Guest cap is 15 requests.
		state.supabase = makeSupabase({
			plan: "guest",
			usage: { tokens_used: 0, requests_used: 15 },
		});
		const response = await POST(chatRequest());
		expect(response.status).toBe(429);
		expect(await response.text()).toMatch(/request limit/i);
	});

	it("returns 429 when the plan token budget is reached", async () => {
		// Guest budget is 50,000 tokens; free lifts the request cap so only the budget bites.
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
});

describe("POST /api/chat — happy path", () => {
	it("streams a 200 response and dedupes sources by document + page", async () => {
		state.supabase = makeSupabase({
			match: [
				{ document_id: "doc-1", name: "Policy.pdf", content: "a", page: 1, similarity: 0.9 },
				// Same doc + page → collapses into the first source.
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
		const sourcesPart = state.writes.find((part) => part.type === "data-sources");
		expect(sourcesPart?.data).toEqual([
			{ documentId: "doc-1", name: "Policy.pdf", page: 1 },
			{ documentId: "doc-2", name: "Handbook.pdf", page: 4 },
		]);
	});
});
