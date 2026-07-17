import { describe, it, expect, beforeEach, vi } from "vitest";

const spies = vi.hoisted(() => ({
	maybeSingle: vi.fn(),
	removeStorage: vi.fn(),
	deleteEq: vi.fn(),
}));

vi.mock("@/shared/config/supabase/server", () => ({
	createClient: async () => ({
		from: () => ({
			select: () => ({ eq: () => ({ maybeSingle: spies.maybeSingle }) }),
			delete: () => ({ eq: spies.deleteEq }),
		}),
		storage: {
			from: () => ({ remove: spies.removeStorage }),
		},
	}),
}));

import { removeDocument } from "../actions";

describe("removeDocument", () => {
	beforeEach(() => {
		spies.maybeSingle.mockReset();
		spies.removeStorage.mockReset();
		spies.deleteEq.mockReset();
		spies.maybeSingle.mockResolvedValue({ data: { storage_path: "user-1/file.pdf" }, error: null });
	});

	it("returns the storage error without removing the document record", async () => {
		spies.removeStorage.mockResolvedValue({ error: { message: "storage boom" } });

		const result = await removeDocument("doc-1");

		expect(result).toEqual({ error: "storage boom" });
		expect(spies.deleteEq).not.toHaveBeenCalled();
	});

	it("removes the storage object before removing the document record", async () => {
		spies.removeStorage.mockResolvedValue({ error: null });
		spies.deleteEq.mockResolvedValue({ error: null });

		const result = await removeDocument("doc-1");

		expect(result).toEqual({});
		expect(spies.removeStorage).toHaveBeenCalledWith(["user-1/file.pdf"]);
		expect(spies.deleteEq).toHaveBeenCalledWith("id", "doc-1");
	});

	it("returns the fetch error without touching storage", async () => {
		spies.maybeSingle.mockResolvedValue({ data: null, error: { message: "not found" } });

		const result = await removeDocument("missing");

		expect(result).toEqual({ error: "not found" });
		expect(spies.removeStorage).not.toHaveBeenCalled();
	});
});
