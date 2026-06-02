import { embed, embedMany } from "ai";
import { embeddingModel, EMBEDDING_DIMS } from "@/lib/ai/provider";

export { EMBEDDING_DIMS };

export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: embeddingModel(), value: text });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({ model: embeddingModel(), values: texts });
  return embeddings;
}
