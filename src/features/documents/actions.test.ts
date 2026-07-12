import { describe, it, expect, beforeEach, vi } from "vitest";

// Shared spies referenced from the mocked Supabase client. `vi.hoisted` lets the
// vi.mock factory (hoisted to the top of the module) reach them safely.
const spies = vi.hoisted(() => ({
	single: vi.fn(),
	removeStorage: vi.fn(),
	deleteEq: vi.fn(),
}));

vi.mock("@/shared/config/supabase/server", () => ({
	createClient: async () => ({
		from: () => ({
			select: () => ({ eq: () => ({ single: spies.single }) }),
			delete: () => ({ eq: spies.deleteEq }),
		}),
		storage: {
			from: () => ({ remove: spies.removeStorage }),
		},
	}),
}));

import { removeDocument } from "./actions";

describe("removeDocument (TD-11: storage before DB row)", () => {
	beforeEach(() => {
		spies.single.mockReset();
		spies.removeStorage.mockReset();
		spies.deleteEq.mockReset();
		spies.single.mockResolvedValue({ data: { storage_path: "user-1/file.pdf" }, error: null });
	});

	it("aborts and does not delete the DB row when storage removal fails", async () => {
		spies.removeStorage.mockResolvedValue({ error: { message: "storage boom" } });

		const result = await removeDocument("doc-1");

		expect(result).toEqual({ error: "storage boom" });
		// The row must survive so the delete can be retried — no orphaned file.
		expect(spies.deleteEq).not.toHaveBeenCalled();
	});

	it("removes the storage object first, then the DB row, on the happy path", async () => {
		spies.removeStorage.mockResolvedValue({ error: null });
		spies.deleteEq.mockResolvedValue({ error: null });

		const result = await removeDocument("doc-1");

		expect(result).toEqual({});
		expect(spies.removeStorage).toHaveBeenCalledWith(["user-1/file.pdf"]);
		expect(spies.deleteEq).toHaveBeenCalledWith("id", "doc-1");
	});

	it("returns the fetch error when the document is not found", async () => {
		spies.single.mockResolvedValue({ data: null, error: { message: "not found" } });

		const result = await removeDocument("missing");

		expect(result).toEqual({ error: "not found" });
		expect(spies.removeStorage).not.toHaveBeenCalled();
	});
});
