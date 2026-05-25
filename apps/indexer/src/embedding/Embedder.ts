/**
 * Turns text into a dense vector for semantic search. Implementations are
 * optional at the application level: when embeddings are unavailable (model
 * failed to load, unsupported platform), a NoopEmbedder stands in and the rest
 * of the app keeps working with keyword search only.
 */
export interface Embedder {
  /** False for the no-op fallback; callers skip vector work when disabled. */
  readonly enabled: boolean;
  /** Vector length produced by `embed` (0 when disabled). */
  readonly dimension: number;
  embed(text: string): Promise<Float32Array>;
  embedBatch(texts: ReadonlyArray<string>): Promise<ReadonlyArray<Float32Array>>;
}
