import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { TurnId } from '@asf/domain';
import { loadSqliteVec } from './extensions/loadSqliteVec';
import { SqliteVecRepository } from './VectorRepository';

let db: Database.Database;
let repo: SqliteVecRepository;

const vec = (...nums: number[]): Float32Array => Float32Array.from(nums);

beforeEach(() => {
  db = new Database(':memory:');
  loadSqliteVec(db);
  // Small dim keeps assertions readable; the repository is dimension-agnostic.
  db.exec('CREATE VIRTUAL TABLE vec_turns USING vec0(turn_id TEXT PRIMARY KEY, embedding FLOAT[4])');
  repo = new SqliteVecRepository(db);
});

afterEach(() => {
  db.close();
});

describe('SqliteVecRepository', () => {
  it('returns the nearest neighbour first', async () => {
    await repo.upsert(TurnId.from('a'), vec(1, 0, 0, 0));
    await repo.upsert(TurnId.from('b'), vec(0, 1, 0, 0));
    await repo.upsert(TurnId.from('c'), vec(0, 0, 1, 0));

    const results = await repo.search(vec(0.9, 0.1, 0, 0), 1);

    expect(results).toHaveLength(1);
    expect(results[0]!.turnId).toBe(TurnId.from('a'));
    expect(results[0]!.distance).toBeGreaterThanOrEqual(0);
  });

  it('returns at most k neighbours, ordered by ascending distance', async () => {
    await repo.upsertBatch([
      { turnId: TurnId.from('a'), embedding: vec(1, 0, 0, 0) },
      { turnId: TurnId.from('b'), embedding: vec(0, 1, 0, 0) },
      { turnId: TurnId.from('c'), embedding: vec(0, 0, 1, 0) },
    ]);

    const results = await repo.search(vec(1, 0, 0, 0), 2);

    expect(results).toHaveLength(2);
    expect(results[0]!.turnId).toBe(TurnId.from('a'));
    expect(results[0]!.distance).toBeLessThanOrEqual(results[1]!.distance);
  });

  it('replaces the vector for an existing turn id (no duplicates)', async () => {
    await repo.upsert(TurnId.from('a'), vec(1, 0, 0, 0));
    await repo.upsert(TurnId.from('a'), vec(0, 0, 0, 1));

    const all = await repo.search(vec(0, 0, 0, 1), 10);
    expect(all.filter((r) => r.turnId === TurnId.from('a'))).toHaveLength(1);
    // The query now matches the replacement vector best.
    expect(all[0]!.turnId).toBe(TurnId.from('a'));
  });

  it('deletes a vector so it no longer appears in search', async () => {
    await repo.upsert(TurnId.from('a'), vec(1, 0, 0, 0));
    await repo.upsert(TurnId.from('b'), vec(0, 1, 0, 0));

    await repo.delete(TurnId.from('a'));

    const results = await repo.search(vec(1, 0, 0, 0), 10);
    expect(results.map((r) => r.turnId)).not.toContain(TurnId.from('a'));
    expect(results.map((r) => r.turnId)).toContain(TurnId.from('b'));
  });

  it('upserts a batch of 1000 vectors and keeps them searchable', async () => {
    const items = Array.from({ length: 1000 }, (_, i) => ({
      turnId: TurnId.from(`t${i}`),
      embedding: vec(i % 7, (i % 5) - 2, i % 3, i % 2),
    }));

    const start = performance.now();
    await repo.upsertBatch(items);
    const elapsed = performance.now() - start;

    const results = await repo.search(vec(0, -2, 0, 0), 5);
    expect(results).toHaveLength(5);
    // Acceptance target is <500ms on an M2; assert a loose bound to avoid CI flake.
    expect(elapsed).toBeLessThan(3000);
  });

  it('accepts an empty batch', async () => {
    await expect(repo.upsertBatch([])).resolves.toBeUndefined();
  });

  it('clearAll removes every vector', async () => {
    await repo.upsertBatch([
      { turnId: TurnId.from('a'), embedding: vec(1, 0, 0, 0) },
      { turnId: TurnId.from('b'), embedding: vec(0, 1, 0, 0) },
    ]);
    await repo.clearAll();
    expect(await repo.search(vec(1, 0, 0, 0), 10)).toHaveLength(0);
  });
});
