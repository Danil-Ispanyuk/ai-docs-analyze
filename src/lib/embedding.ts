import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";

export async function embedChunks(texts: string[]): Promise<number[][]> {
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: texts,
  });
  return embeddings;
}
