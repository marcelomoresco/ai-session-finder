import type { Embedder } from './Embedder';

/**
 * Fallback embedder used when semantic search is disabled or Transformers.js
 * fails to load. It downloads nothing and produces no vectors, so the app runs
 * with keyword search only. Keeping it a real Embedder means callers never need
 * a null check — they gate on `enabled`.
 */
export class NoopEmbedder implements Embedder {
  readonly enabled = false;
  readonly dimension = 0;

  embed(_text: string): Promise<Float32Array> {
    return Promise.resolve(new Float32Array());
  }

  embedBatch(_texts: ReadonlyArray<string>): Promise<ReadonlyArray<Float32Array>> {
    return Promise.resolve([]);
  }
}
