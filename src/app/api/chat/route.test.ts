import { describe, it, expect, beforeEach, vi } from "vitest";

const state = vi.hoisted(() => ({
	user: null as { id: string } | null,
	supabase: null as unknown,
	writes: [] as { type: string; data?: unknown }[],
	embedInputs: [] as string[][],
	executePromise: null as Promise<void> | null,
	streamText: null as { instructions?: string } | null,
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
	streamText: (options: { instructions?: string }) => {
		state.streamText = options;
		return { toUIMessageStream: () => ({}) };
	},
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
	match?: ({ document_id: string } & Record<string, unknown>)[];
	matchError?: { message: string } | null;
	documents?: string[];
	inventory?: { name: string; folders: { name: string } | { name: string }[] | null }[];
	documentStatus?: string | null;
	documentError?: { message: string } | null;
	fallbackChunks?: unknown[];
	fallbackError?: { message: string } | null;
	onMatchChunks?: (args: Record<string, unknown>) => void;
	onInsert?: (table: string, data: unknown) => void;
};

function makeSupabase(config: SupabaseConfig) {
	const {
		rate = true,
		rateError = null,
		plan = "guest",
		usage = { tokens_used: 0, requests_used: 0 },
		match = [],
		matchError = null,
		documents = [],
		inventory = [],
		documentStatus = "ready",
		documentError = null,
		fallbackChunks = [],
		fallbackError = null,
		onMatchChunks,
		onInsert,
	} = config;

	return {
		rpc: (name: string, args?: Record<string, unknown>) => {
			if (name === "check_chat_rate") return { data: rate, error: rateError };
			if (name === "get_usage") return { data: [usage], error: null };
			if (name === "match_chunks") {
				onMatchChunks?.(args ?? {});
				if (matchError) return { data: null, error: matchError };
				const ids = args?.document_ids as string[] | null | undefined;
				const rows = Array.isArray(ids)
					? match.filter((row) => ids.includes(row.document_id))
					: match;
				const count = (args?.match_count as number) ?? rows.length;
				return { data: rows.slice(0, count), error: null };
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

			if (table === "documents") {
				let ordered = false;
				const query: Record<string, unknown> = {
					select: () => query,
					eq: () => query,
					order: () => {
						ordered = true;
						return query;
					},
					maybeSingle: async () => ({
						data: documentStatus ? { status: documentStatus } : null,
						error: documentError,
					}),
					then: (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
						Promise.resolve({
							data: ordered ? inventory : documents.map((id) => ({ id })),
							error: null,
						}).then(resolve),
				};
				return query;
			}

			const fallbackQuery = {
				select: () => fallbackQuery,
				order: () => fallbackQuery,
				limit: () => fallbackQuery,
				in: () => fallbackQuery,
				insert: async (data: unknown) => {
					onInsert?.(table, data);
					return { data: null, error: null };
				},
				then: (
					resolve: (value: { data: unknown[]; error: { message: string } | null }) => unknown,
				) => Promise.resolve({ data: fallbackChunks, error: fallbackError }).then(resolve),
			};
			return fallbackQuery;
		},
	};
}

function chatRequest(body: unknown = { messages: [] }): Request {
	return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
	state.user = { id: "user-1" };
	state.supabase = makeSupabase({});
	state.writes = [];
	state.embedInputs = [];
	state.executePromise = null;
	state.streamText = null;
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
			chatRequest({ messages: [{ parts: [{ type: "text", text: "hi" }] }], documentId: "doc-1" }),
		);
		expect(response.status).toBe(500);
	});

	it("returns 400 before persisting when a scoped document is not ready", async () => {
		const inserts: unknown[] = [];
		state.supabase = makeSupabase({
			documentStatus: "error",
			onInsert: (_table, data) => inserts.push(data),
		});

		const response = await POST(
			chatRequest({ messages: [{ parts: [{ type: "text", text: "hi" }] }], documentId: "doc-1" }),
		);

		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/indexed/i);
		expect(inserts).toEqual([]);
	});

	it("returns 400 when the question is empty", async () => {
		const response = await POST(chatRequest({ messages: [] }));

		expect(response.status).toBe(400);
		expect(await response.text()).toMatch(/question is required/i);
		expect(state.embedInputs).toEqual([]);
	});
});

describe("POST /api/chat — happy path", () => {
	it("dedupes sources by document + page across a folder scope", async () => {
		let matchArgs: Record<string, unknown> | undefined;
		state.supabase = makeSupabase({
			documents: ["doc-1", "doc-2"],
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
				folderId: "folder-1",
			}),
		);
		await state.executePromise;

		expect(response.status).toBe(200);
		expect(matchArgs).toMatchObject({ match_count: 6, match_threshold: 0.12 });
		const sourcesPart = state.writes.find((part) => part.type === "data-sources");
		expect(sourcesPart?.data).toEqual([
			{ documentId: "doc-1", name: "Policy.pdf", page: 1 },
			{ documentId: "doc-2", name: "Handbook.pdf", page: 4 },
		]);
	});

	it("balances retrieval across documents in the all-documents scope", async () => {
		const calls: (string[] | null)[] = [];
		state.supabase = makeSupabase({
			documents: ["doc-1", "doc-2"],
			onMatchChunks: (args) => {
				calls.push((args.document_ids as string[]) ?? null);
			},
			match: [
				{ document_id: "doc-1", name: "Policy.pdf", content: "a", page: 1, similarity: 0.6 },
				{ document_id: "doc-2", name: "Handbook.pdf", content: "c", page: 4, similarity: 0.9 },
			],
		});

		const response = await POST(
			chatRequest({
				messages: [{ parts: [{ type: "text", text: "What are these about?" }] }],
			}),
		);
		await state.executePromise;

		expect(response.status).toBe(200);
		expect(calls).toEqual([["doc-1"], ["doc-2"]]);
		const sourcesPart = state.writes.find((part) => part.type === "data-sources");
		expect(sourcesPart?.data).toEqual([
			{ documentId: "doc-2", name: "Handbook.pdf", page: 4 },
			{ documentId: "doc-1", name: "Policy.pdf", page: 1 },
		]);
	});

	it("includes the folder inventory in the prompt so it can answer file-location questions", async () => {
		state.supabase = makeSupabase({
			documents: ["doc-1"],
			inventory: [
				{ name: "Handbook.pdf", folders: { name: "HR Policies" } },
				{ name: "Onboarding.pdf", folders: null },
			],
			match: [
				{ document_id: "doc-1", name: "Handbook.pdf", content: "a", page: 1, similarity: 0.9 },
			],
		});

		const response = await POST(
			chatRequest({
				messages: [{ parts: [{ type: "text", text: "Which folder is the handbook in?" }] }],
			}),
		);
		await state.executePromise;

		expect(response.status).toBe(200);
		const instructions = state.streamText?.instructions ?? "";
		expect(instructions).toContain('"Handbook.pdf" → folder "HR Policies"');
		expect(instructions).toContain('"Onboarding.pdf" → not in any folder');
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
				documentId: "doc-1",
			}),
		);
		await state.executePromise;

		expect(response.status).toBe(200);
		const sourcesPart = state.writes.find((part) => part.type === "data-sources");
		expect(sourcesPart?.data).toEqual([{ documentId: "doc-1", name: "Overview.pdf", page: 1 }]);
	});
});
