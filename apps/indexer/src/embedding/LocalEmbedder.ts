import type { Embedder } from './Embedder';

/** Minimal shape of a Transformers.js feature-extraction tensor we rely on. */
export interface EmbeddingTensor {
  readonly data: Float32Array | readonly number[];
  readonly dims: readonly number[];
}

/** A callable feature-extraction pipeline (single string or a batch). */
export type EmbeddingPipeline = (
  input: string | string[],
  options: { readonly pooling: 'mean'; readonly normalize: boolean },
) => Promise<EmbeddingTensor>;

/** Creates the (expensive) pipeline. Injected so tests run without the model. */
export type PipelineFactory = () => Promise<EmbeddingPipeline>;

const MODEL = 'nomic-ai/nomic-embed-text-v1.5';
const DIMENSION = 768;

/**
 * Loads `@huggingface/transformers` lazily and dynamically: the import only runs
 * the first time an embedding is requested, so importing this module never pulls
 * in onnxruntime, and a load failure can be caught by the caller (which then
 * falls back to NoopEmbedder) instead of crashing at startup.
 */
const defaultFactory: PipelineFactory = async () => {
  const { pipeline } = await import('@huggingface/transformers');
  const pipe = await pipeline('feature-extraction', MODEL, { dtype: 'q8' });
  return (input, options) => pipe(input, options) as Promise<EmbeddingTensor>;
};

/**
 * On-device embedder backed by nomic-embed-text-v1.5 (768-dim, mean-pooled,
 * normalized). The model is lazy-loaded on first use and cached by
 * Transformers.js under `~/.cache/huggingface/`.
 */
export class LocalEmbedder implements Embedder {
  readonly enabled = true;
  readonly dimension = DIMENSION;
  private pipelinePromise: Promise<EmbeddingPipeline> | null = null;

  constructor(private readonly createPipeline: PipelineFactory = defaultFactory) {}

  async embed(text: string): Promise<Float32Array> {
    const pipe = await this.getPipeline();
    const tensor = await pipe(text, { pooling: 'mean', normalize: true });
    return Float32Array.from(tensor.data);
  }

  async embedBatch(texts: ReadonlyArray<string>): Promise<ReadonlyArray<Float32Array>> {
    if (texts.length === 0) {
      return [];
    }
    const pipe = await this.getPipeline();
    const tensor = await pipe([...texts], { pooling: 'mean', normalize: true });
    const dim = tensor.dims.at(-1) ?? this.dimension;
    const flat = Float32Array.from(tensor.data);
    return Array.from({ length: texts.length }, (_, i) => flat.slice(i * dim, (i + 1) * dim));
  }

  /** Creates the pipeline on first use and memoizes the in-flight promise. */
  private getPipeline(): Promise<EmbeddingPipeline> {
    this.pipelinePromise ??= this.createPipeline();
    return this.pipelinePromise;
  }
}
