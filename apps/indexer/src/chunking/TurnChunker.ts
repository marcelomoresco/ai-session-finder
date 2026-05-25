import type { Turn, TurnId } from '@asf/domain';
import { CHARS_PER_TOKEN, estimateTokens } from './tokenize';

export interface Chunk {
  readonly turnId: TurnId;
  readonly chunkIndex: number;
  readonly text: string;
  readonly tokenCount: number;
}

export interface ChunkerOptions {
  readonly maxTokens: number;
  readonly overlapTokens: number;
}

const DEFAULT_OPTIONS: ChunkerOptions = { maxTokens: 800, overlapTokens: 100 };

/** Terminators we prefer to break on before falling back to a hard character cut. */
const SENTENCE_BOUNDARY = /[.!?\n]/;

/**
 * Splits long turns into overlapping chunks for embedding. Short turns pass
 * through as a single chunk. Long turns use a sliding window that prefers
 * sentence boundaries but always respects a hard character cap, so no chunk
 * exceeds `maxTokens`.
 *
 * Each window steps back a *fixed* `overlapChars` from the previous end, so
 * adjacent chunks always share exactly that many characters — overlap is
 * predictable regardless of where a sentence boundary landed.
 */
export class TurnChunker {
  private readonly windowChars: number;
  private readonly overlapChars: number;

  constructor(private readonly opts: ChunkerOptions = DEFAULT_OPTIONS) {
    if (opts.maxTokens < 1) {
      throw new Error('TurnChunker: maxTokens must be >= 1');
    }
    if (opts.overlapTokens < 0) {
      throw new Error('TurnChunker: overlapTokens must be >= 0');
    }
    if (opts.overlapTokens >= opts.maxTokens) {
      throw new Error('TurnChunker: overlapTokens must be smaller than maxTokens');
    }
    this.windowChars = opts.maxTokens * CHARS_PER_TOKEN;
    this.overlapChars = opts.overlapTokens * CHARS_PER_TOKEN;
  }

  chunk(turn: Turn): ReadonlyArray<Chunk> {
    const total = estimateTokens(turn.contentText);
    if (total <= this.opts.maxTokens) {
      return [{ turnId: turn.id, chunkIndex: 0, text: turn.contentText, tokenCount: total }];
    }
    return this.slideWindow(turn);
  }

  private slideWindow(turn: Turn): ReadonlyArray<Chunk> {
    const text = turn.contentText;
    const chunks: Chunk[] = [];
    let start = 0;
    let index = 0;

    while (start < text.length) {
      const hardEnd = Math.min(start + this.windowChars, text.length);
      const end = hardEnd >= text.length ? hardEnd : this.snapToSentence(text, start, hardEnd);
      const slice = text.slice(start, end);
      chunks.push({
        turnId: turn.id,
        chunkIndex: index,
        text: slice,
        tokenCount: estimateTokens(slice),
      });
      index += 1;
      if (end >= text.length) {
        break;
      }
      start = end - this.overlapChars;
    }

    return chunks;
  }

  /**
   * Last sentence boundary in the back half of the window, or `hardEnd` if none.
   * Never before `start + overlapChars + 1` (so the next window progresses) and
   * never past `hardEnd` (so the chunk stays within maxTokens).
   */
  private snapToSentence(text: string, start: number, hardEnd: number): number {
    const floor = Math.max(start + this.overlapChars + 1, start + Math.floor(this.windowChars / 2));
    for (let i = hardEnd - 1; i >= floor; i -= 1) {
      if (SENTENCE_BOUNDARY.test(text.charAt(i))) {
        return i + 1;
      }
    }
    return hardEnd;
  }
}
