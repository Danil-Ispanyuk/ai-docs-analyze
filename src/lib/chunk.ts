export interface IChunk {
	content: string;
	page: number;
	chunkIndex: number;
}

export function chunkPages(
	pages: { page: number; text: string }[],
	{ size = 1000, overlap = 150 }: { size?: number; overlap?: number } = {}
): IChunk[] {
    const chunks: IChunk[] = [];
    const step = Math.max(1, size - overlap);

    let chunkIndex = 0;

    for (const { page, text } of pages) {
        if (!text) continue;

        for (let start = 0; start < text.length; start +=step) {
            const content = text.slice(start, start + size).trim();
            if (content) chunks.push({ content, page, chunkIndex: chunkIndex++ });
        }
    }

    return chunks
}
