import { describe, it, expect } from 'vitest';
import { NoopEmbedder } from './NoopEmbedder';

describe('NoopEmbedder', () => {
  it('is disabled and reports a zero dimension', () => {
    const embedder = new NoopEmbedder();
    expect(embedder.enabled).toBe(false);
    expect(embedder.dimension).toBe(0);
  });

  it('returns an empty vector for embed (no model, no download)', async () => {
    const embedder = new NoopEmbedder();
    expect(await embedder.embed('anything at all')).toEqual(new Float32Array());
  });

  it('returns an empty array for embedBatch', async () => {
    const embedder = new NoopEmbedder();
    expect(await embedder.embedBatch(['a', 'b', 'c'])).toEqual([]);
  });
});
