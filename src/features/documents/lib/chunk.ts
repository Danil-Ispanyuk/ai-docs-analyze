export interface Chunk {
	content: string;
	page: number;
	chunkIndex: number;
}
const SENTENCE_BOUNDARY = /(?<=[.!?…])\s+(?=["'“‘([]?[A-Z0-9])/;

function splitIntoSentences(text: string): string[] {
	return text
		.split(/\n{2,}/)
		.flatMap((paragraph) => paragraph.split(SENTENCE_BOUNDARY))
		.map((sentence) => sentence.replace(/\s+/g, " ").trim())
		.filter(Boolean);
}

export function chunkPages(
	pages: { page: number; text: string }[],
	{ size = 1000, overlap = 150 }: { size?: number; overlap?: number } = {},
): Chunk[] {
	const chunks: Chunk[] = [];
	let chunkIndex = 0;

	for (const { page, text } of pages) {
		if (!text) continue;
		const sentences = splitIntoSentences(text);
		if (!sentences.length) continue;

		let current: string[] = [];
		let currentLength = 0;

		const flush = () => {
			const content = current.join(" ").trim();
			if (content) chunks.push({ content, page, chunkIndex: chunkIndex++ });
		};

		for (const sentence of sentences) {
			if (sentence.length > size) {
				flush();
				current = [];
				currentLength = 0;
				const step = Math.max(1, size - overlap);
				for (let start = 0; start < sentence.length; start += step) {
					const slice = sentence.slice(start, start + size).trim();
					if (slice) chunks.push({ content: slice, page, chunkIndex: chunkIndex++ });
				}
				continue;
			}

			if (currentLength + sentence.length + 1 > size && current.length) {
				flush();
				const carried: string[] = [];
				let carriedLength = 0;
				for (
					let sentenceIndex = current.length - 1;
					sentenceIndex >= 0 && carriedLength < overlap;
					sentenceIndex--
				) {
					carried.unshift(current[sentenceIndex]);
					carriedLength += current[sentenceIndex].length + 1;
				}
				current = carried;
				currentLength = carriedLength;
			}

			current.push(sentence);
			currentLength += sentence.length + 1;
		}

		flush();
	}

	return chunks;
}
