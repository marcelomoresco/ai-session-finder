import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SessionId, TurnId, type Turn } from '@asf/domain';
import { TurnChunker, type Chunk, type ChunkerOptions } from './TurnChunker';
import { CHARS_PER_TOKEN, estimateTokens } from './tokenize';

function makeTurn(contentText: string): Turn {
  return {
    id: TurnId.from('session-x:0'),
    sessionId: SessionId.from('session-x'),
    index: 0,
    role: 'assistant',
    contentText,
    toolCalls: [],
    filesTouched: [],
    timestamp: new Date(0),
  };
}

// Adjacent chunks always share exactly `overlapChars` characters (the window
// steps back a fixed amount), so dropping that prefix from every chunk after
// the first must rebuild the original text exactly — for any input.
function reconstruct(chunks: ReadonlyArray<Chunk>, overlapChars: number): string {
  if (chunks.length === 0) return '';
  return chunks.slice(1).reduce((acc, c) => acc + c.text.slice(overlapChars), chunks[0]!.text);
}

const OPTS: ChunkerOptions = { maxTokens: 8, overlapTokens: 2 };
const OVERLAP_CHARS = OPTS.overlapTokens * CHARS_PER_TOKEN;

describe('TurnChunker', () => {
  it('returns a single chunk when the turn fits within maxTokens', () => {
    const turn = makeTurn('short text');
    const chunks = new TurnChunker(OPTS).chunk(turn);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ turnId: turn.id, chunkIndex: 0, text: 'short text' });
  });

  it('splits a long turn into multiple ordered chunks', () => {
    const turn = makeTurn('a'.repeat(OPTS.maxTokens * CHARS_PER_TOKEN * 4));
    const chunks = new TurnChunker(OPTS).chunk(turn);
    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((c, i) => expect(c.chunkIndex).toBe(i));
  });

  it('rejects options where overlap is not smaller than the window', () => {
    expect(() => new TurnChunker({ maxTokens: 4, overlapTokens: 4 })).toThrow();
  });

  it('rejects a maxTokens below 1', () => {
    expect(() => new TurnChunker({ maxTokens: 0, overlapTokens: 0 })).toThrow();
  });

  it('rejects a negative overlapTokens', () => {
    expect(() => new TurnChunker({ maxTokens: 8, overlapTokens: -1 })).toThrow();
  });

  it('prefers to break a chunk at a sentence boundary within the window', () => {
    // window = 32 chars; a single '.' sits in the back half (index 20), so the
    // first chunk should end right after it rather than at the hard 32-char cut.
    const turn = makeTurn('a'.repeat(20) + '.' + 'b'.repeat(40));
    const [first] = new TurnChunker(OPTS).chunk(turn);
    expect(first!.text).toBe('a'.repeat(20) + '.');
  });

  describe('properties (100 generated cases)', () => {
    const chunker = new TurnChunker(OPTS);

    it('covers the entire original text (overlap removed)', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 600 }), (text) => {
          const chunks = chunker.chunk(makeTurn(text));
          expect(reconstruct(chunks, OVERLAP_CHARS)).toBe(text);
        }),
        { numRuns: 100 },
      );
    });

    it('preserves order with contiguous chunkIndex from 0', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 600 }), (text) => {
          const chunks = chunker.chunk(makeTurn(text));
          expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
        }),
        { numRuns: 100 },
      );
    });

    it('never emits a chunk exceeding maxTokens, and tokenCount is consistent', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 600 }), (text) => {
          const chunks = chunker.chunk(makeTurn(text));
          for (const c of chunks) {
            expect(c.tokenCount).toBe(estimateTokens(c.text));
            expect(c.tokenCount).toBeLessThanOrEqual(OPTS.maxTokens);
          }
        }),
        { numRuns: 100 },
      );
    });

    it('emits at least one chunk and tags every chunk with the turn id', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 600 }), (text) => {
          const turn = makeTurn(text);
          const chunks = chunker.chunk(turn);
          expect(chunks.length).toBeGreaterThanOrEqual(1);
          expect(chunks.every((c) => c.turnId === turn.id)).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  });
});
