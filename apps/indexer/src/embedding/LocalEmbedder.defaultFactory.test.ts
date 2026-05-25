import { describe, it, expect, vi } from 'vitest';
import { LocalEmbedder } from './LocalEmbedder';

// Isolated in its own file so the mock can't leak into the real-model E2E test.
// Exercises the default pipeline factory (the dynamic `@huggingface/transformers`
// import + tensor wiring) without downloading a model.
const { fakePipeline } = vi.hoisted(() => {
  const pipe = (input: string | string[]) =>
    Promise.resolve(
      Array.isArray(input)
        ? { data: Float32Array.from([0, 1, 2, 3]), dims: [input.length, 2] }
        : { data: Float32Array.from([7, 8]), dims: [2] },
    );
  return { fakePipeline: () => Promise.resolve(pipe) };
});

vi.mock('@huggingface/transformers', () => ({ pipeline: fakePipeline }));

describe('LocalEmbedder default factory', () => {
  it('dynamically imports transformers and maps a single tensor', async () => {
    const vector = await new LocalEmbedder().embed('hello');
    expect(Array.from(vector)).toEqual([7, 8]);
  });

  it('dynamically imports transformers and splits a batch tensor', async () => {
    const vectors = await new LocalEmbedder().embedBatch(['a', 'b']);
    expect(vectors).toHaveLength(2);
    expect(Array.from(vectors[0]!)).toEqual([0, 1]);
    expect(Array.from(vectors[1]!)).toEqual([2, 3]);
  });
});
