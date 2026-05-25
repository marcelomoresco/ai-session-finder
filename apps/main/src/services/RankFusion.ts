export interface RankedItem {
  readonly id: string;
  readonly rank: number;
}

export interface FusedItem {
  readonly id: string;
  readonly score: number;
}

/**
 * Reciprocal Rank Fusion: combines multiple ranked lists into one. Each list
 * contributes `1 / (k + rank)` to an item's score; items appearing high in
 * several lists rise to the top. `k` (default 60) damps the influence of top
 * ranks, the standard RRF constant.
 */
export class RankFusion {
  static fuse(
    rankings: ReadonlyArray<ReadonlyArray<RankedItem>>,
    k = 60,
  ): ReadonlyArray<FusedItem> {
    const scores = new Map<string, number>();
    for (const ranking of rankings) {
      for (const item of ranking) {
        const previous = scores.get(item.id) ?? 0;
        scores.set(item.id, previous + 1 / (k + item.rank));
      }
    }
    return [...scores.entries()]
      .map(([id, score]) => ({ id, score }))
      .sort((a, b) => b.score - a.score);
  }
}
