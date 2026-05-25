import { describe, it, expect } from 'vitest';
import {
  LocalEmbedder,
  type EmbeddingPipeline,
  type EmbeddingTensor,
  type PipelineFactory,
} from './LocalEmbedder';

/** Builds a fake pipeline returning a fixed tensor, counting how often it's created. */
function fakeFactory(
  pipe: EmbeddingPipeline,
): { factory: PipelineFactory; calls: () => number } {
  let calls = 0;
  return {
    factory: () => {
      calls += 1;
      return Promise.resolve(pipe);
    },
    calls: () => calls,
  };
}

const singleTensor = (data: number[]): EmbeddingTensor => ({
  data: Float32Array.from(data),
  dims: [data.length],
});

describe('LocalEmbedder', () => {
  it('is enabled and reports the 768-dim nomic vector size', () => {
    const { factory } = fakeFactory(() => Promise.resolve(singleTensor([0])));
    const embedder = new LocalEmbedder(factory);
    expect(embedder.enabled).toBe(true);
    expect(embedder.dimension).toBe(768);
  });

  it('does not create the pipeline in the constructor (lazy load)', () => {
    const { factory, calls } = fakeFactory(() => Promise.resolve(singleTensor([1, 2, 3])));
    new LocalEmbedder(factory);
    expect(calls()).toBe(0);
  });

  it('creates the pipeline once and reuses it across calls', async () => {
    const { factory, calls } = fakeFactory(() => Promise.resolve(singleTensor([1, 2, 3])));
    const embedder = new LocalEmbedder(factory);
    await embedder.embed('first');
    await embedder.embed('second');
    expect(calls()).toBe(1);
  });

  it('returns the model output as a Float32Array for a single text', async () => {
    const { factory } = fakeFactory(() => Promise.resolve(singleTensor([0.5, -0.5, 0.25])));
    const vector = await new LocalEmbedder(factory).embed('hello');
    expect(vector).toBeInstanceOf(Float32Array);
    expect(Array.from(vector)).toEqual([0.5, -0.5, 0.25]);
  });

  it('splits a [batch, dim] tensor into one vector per input, in order', async () => {
    // 3 inputs × dim 2, row-major: [r0, r0, r1, r1, r2, r2]
    const batched: EmbeddingPipeline = () =>
      Promise.resolve({ data: Float32Array.from([0, 1, 2, 3, 4, 5]), dims: [3, 2] });
    const vectors = await new LocalEmbedder(fakeFactory(batched).factory).embedBatch([
      'a',
      'b',
      'c',
    ]);
    expect(vectors).toHaveLength(3);
    expect(Array.from(vectors[0]!)).toEqual([0, 1]);
    expect(Array.from(vectors[1]!)).toEqual([2, 3]);
    expect(Array.from(vectors[2]!)).toEqual([4, 5]);
  });

  it('returns [] for an empty batch without creating the pipeline', async () => {
    const { factory, calls } = fakeFactory(() => Promise.resolve(singleTensor([0])));
    const vectors = await new LocalEmbedder(factory).embedBatch([]);
    expect(vectors).toEqual([]);
    expect(calls()).toBe(0);
  });
});

// Real model: downloads ~prebuilt onnx weights and runs onnxruntime. Slow and
// networked, so it only runs when explicitly opted in.
const E2E = process.env['ASF_EMBEDDER_E2E'] === '1';

function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

describe.skipIf(!E2E)('LocalEmbedder (real model — ASF_EMBEDDER_E2E=1)', () => {
  it('produces 768-dim vectors with sensible cosine similarities', async () => {
    const embedder = new LocalEmbedder();
    const [a, b, c] = await embedder.embedBatch([
      'the cat sat on the warm mat',
      'a feline rested on the cozy rug',
      'quarterly corporate tax filing deadlines',
    ]);
    expect(a!.length).toBe(768);
    expect(cosine(a!, b!)).toBeGreaterThan(0.7);
    expect(cosine(a!, c!)).toBeLessThan(0.5);
  }, 120_000);
});
