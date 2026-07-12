import { describe, it, expect } from "vitest";
import { chunkPages } from "./chunk";

describe("chunkPages", () => {
	it("returns nothing for empty input", () => {
		expect(chunkPages([])).toEqual([]);
	});

	it("skips pages with empty or whitespace-only text", () => {
		expect(
			chunkPages([
				{ page: 1, text: "" },
				{ page: 2, text: "   \n  " },
			]),
		).toEqual([]);
	});

	it("keeps a short single sentence as one chunk", () => {
		const chunks = chunkPages([{ page: 3, text: "The onboarding policy is simple." }]);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toEqual({
			content: "The onboarding policy is simple.",
			page: 3,
			chunkIndex: 0,
		});
	});

	it("collapses internal whitespace inside a sentence", () => {
		const chunks = chunkPages([{ page: 1, text: "Hello \n\t  world   again." }]);
		expect(chunks).toHaveLength(1);
		expect(chunks[0].content).toBe("Hello world again.");
	});

	it("packs multiple sentences that fit within `size` into one chunk", () => {
		const chunks = chunkPages([{ page: 1, text: "Alpha one. Bravo two. Charlie three." }], {
			size: 1000,
			overlap: 150,
		});
		expect(chunks).toHaveLength(1);
		expect(chunks[0].content).toBe("Alpha one. Bravo two. Charlie three.");
	});

	it("splits across chunks with sentence-level overlap", () => {
		const chunks = chunkPages([{ page: 1, text: "Alpha one. Bravo two. Charlie three." }], {
			size: 20,
			overlap: 5,
		});
		expect(chunks.length).toBeGreaterThan(1);
		// Every chunk carries whole sentences (never a mid-word cut) and stays on the page.
		for (const chunk of chunks) {
			expect(chunk.page).toBe(1);
			expect(chunk.content).toMatch(/\.$/);
		}
		// A sentence should reappear across a boundary (overlap), e.g. "Bravo two.".
		const bravoCount = chunks.filter((chunk) => chunk.content.includes("Bravo two.")).length;
		expect(bravoCount).toBeGreaterThan(1);
	});

	it("hard-splits a single sentence longer than `size` on character windows", () => {
		const longWord = "x".repeat(50);
		const chunks = chunkPages([{ page: 2, text: longWord }], { size: 20, overlap: 5 });
		// step = size - overlap = 15 → starts at 0,15,30,45 → 4 windows.
		expect(chunks).toHaveLength(4);
		for (const chunk of chunks) {
			expect(chunk.content.length).toBeLessThanOrEqual(20);
			expect(chunk.page).toBe(2);
		}
	});

	it("assigns a global, sequential chunkIndex across pages and preserves page numbers", () => {
		const chunks = chunkPages([
			{ page: 1, text: "First page sentence." },
			{ page: 2, text: "Second page sentence." },
		]);
		expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual([0, 1]);
		expect(chunks.map((chunk) => chunk.page)).toEqual([1, 2]);
	});
});
