import { extractText, getDocumentProxy } from "unpdf";

export default async function extractPdfPages(
	data: Uint8Array,
): Promise<{ page: number; text: string }[]> {
	const pdf = await getDocumentProxy(data);

	const { text } = await extractText(pdf, { mergePages: false });

	return text.map((pageText, index) => ({
		page: index + 1,
		text: pageText.replace(/\s+/g, " ").trim(),
	}));
}
