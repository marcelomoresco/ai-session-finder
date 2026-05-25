/** Characters per token for the fast heuristic estimate. */
export const CHARS_PER_TOKEN = 4;

/**
 * Cheap token-count estimate (~chars / CHARS_PER_TOKEN). Deliberately not exact:
 * it only decides whether a turn needs chunking, so the cost and weight of a
 * real tokenizer isn't justified here.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
