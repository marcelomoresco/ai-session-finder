import { describe, it, expect } from 'vitest';
import { RankFusion } from './RankFusion';

describe('RankFusion', () => {
  it('returns an empty list for no rankings', () => {
    expect(RankFusion.fuse([])).toEqual([]);
  });

  it('preserves order when a single ranking is given', () => {
    const fused = RankFusion.fuse([
      [
        { id: 'a', rank: 0 },
        { id: 'b', rank: 1 },
        { id: 'c', rank: 2 },
      ],
    ]);
    expect(fused.map((f) => f.id)).toEqual(['a', 'b', 'c']);
  });

  it('ranks an item appearing high in both lists above one-list items', () => {
    const fused = RankFusion.fuse([
      [
        { id: 'shared', rank: 0 },
        { id: 'onlyA', rank: 1 },
      ],
      [
        { id: 'shared', rank: 0 },
        { id: 'onlyB', rank: 1 },
      ],
    ]);
    expect(fused[0]!.id).toBe('shared');
    // shared got contributions from both lists, so it scores highest.
    expect(fused[0]!.score).toBeGreaterThan(fused[1]!.score);
  });

  it('sums reciprocal-rank contributions for duplicate ids', () => {
    const k = 60;
    const fused = RankFusion.fuse(
      [
        [{ id: 'x', rank: 0 }],
        [{ id: 'x', rank: 0 }],
      ],
      k,
    );
    expect(fused).toHaveLength(1);
    expect(fused[0]!.score).toBeCloseTo(2 / (k + 0));
  });

  it('orders purely by fused score (descending)', () => {
    const fused = RankFusion.fuse([
      [
        { id: 'low', rank: 5 },
        { id: 'high', rank: 0 },
      ],
    ]);
    expect(fused.map((f) => f.id)).toEqual(['high', 'low']);
  });
});
