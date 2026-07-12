import { describe, it, expect, beforeEach, vi } from "vitest";

// Stub unpdf so the extractor runs without a real PDF: getDocumentProxy just
// echoes a marker, and extractText returns whatever page array the test sets.
const unpdf = vi.hoisted(() => ({
	getDocumentProxy: vi.fn(),
	extractText: vi.fn(),
}));

vi.mock("unpdf", () => ({
	getDocumentProxy: unpdf.getDocumentProxy,
	extractText: unpdf.extractText,
}));

import extractPdfPages from "./pdf";

describe("extractPdfPages", () => {
	beforeEach(() => {
		unpdf.getDocumentProxy.mockReset();
		unpdf.extractText.mockReset();
		unpdf.getDocumentProxy.mockResolvedValue({ proxy: true });
	});

	it("numbers pages from 1 and normalizes whitespace per page", async () => {
		unpdf.extractText.mockResolvedValue({
			text: ["Hello \n\t world", "  Second   page \n here  "],
		});

		const pages = await extractPdfPages(new Uint8Array());

		expect(pages).toEqual([
			{ page: 1, text: "Hello world" },
			{ page: 2, text: "Second page here" },
		]);
	});

	it("requests unmerged pages so each page stays separate", async () => {
		unpdf.extractText.mockResolvedValue({ text: ["a"] });

		await extractPdfPages(new Uint8Array());

		expect(unpdf.extractText).toHaveBeenCalledWith({ proxy: true }, { mergePages: false });
	});

	it("returns an empty array for a document with no pages", async () => {
		unpdf.extractText.mockResolvedValue({ text: [] });

		expect(await extractPdfPages(new Uint8Array())).toEqual([]);
	});

	it("collapses a whitespace-only page to an empty string", async () => {
		unpdf.extractText.mockResolvedValue({ text: ["   \n\t  "] });

		expect(await extractPdfPages(new Uint8Array())).toEqual([{ page: 1, text: "" }]);
	});
});
