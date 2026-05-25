/* eslint-disable @typescript-eslint/require-await --
   Async adapter over the synchronous better-sqlite3 driver (mirrors
   SQLiteRepository): the VectorRepository contract is Promise-based while the
   implementation is intentionally synchronous, so methods correctly lack await. */
import type Database from 'better-sqlite3';
import { TurnId } from '@asf/domain';
import { DELETE_VEC_TURN, INSERT_VEC_TURN, SEARCH_VEC_TURNS } from './queries';

export interface VectorSearchHit {
  readonly turnId: TurnId;
  readonly distance: number;
}

export interface VectorUpsert {
  readonly turnId: TurnId;
  readonly embedding: Float32Array;
}

/**
 * Stores and searches turn embeddings for semantic (k-NN) search. Only usable
 * when the sqlite-vec extension loaded and `vec_turns` exists; the Pipeline
 * holds `null` instead when semantic search is disabled.
 */
export interface VectorRepository {
  upsert(turnId: TurnId, embedding: Float32Array): Promise<void>;
  upsertBatch(items: ReadonlyArray<VectorUpsert>): Promise<void>;
  delete(turnId: TurnId): Promise<void>;
  search(queryVector: Float32Array, k: number): Promise<ReadonlyArray<VectorSearchHit>>;
}

/**
 * Maps a Float32Array to the exact little-endian bytes sqlite-vec stores. Uses
 * byteOffset/byteLength so a subarray *view* (e.g. one row sliced out of a batch
 * tensor) doesn't drag in the rest of its backing buffer.
 */
function toBlob(embedding: Float32Array): Buffer {
  return Buffer.from(embedding.buffer, embedding.byteOffset, embedding.byteLength);
}

export class SqliteVecRepository implements VectorRepository {
  constructor(private readonly db: Database.Database) {}

  async upsert(turnId: TurnId, embedding: Float32Array): Promise<void> {
    await this.upsertBatch([{ turnId, embedding }]);
  }

  async upsertBatch(items: ReadonlyArray<VectorUpsert>): Promise<void> {
    const remove = this.db.prepare(DELETE_VEC_TURN);
    const insert = this.db.prepare(INSERT_VEC_TURN);
    const upsertAll = this.db.transaction((rows: ReadonlyArray<VectorUpsert>) => {
      for (const { turnId, embedding } of rows) {
        remove.run(turnId); // vec0 has no UPSERT; delete-then-insert replaces.
        insert.run(turnId, toBlob(embedding));
      }
    });
    upsertAll(items);
  }

  async delete(turnId: TurnId): Promise<void> {
    this.db.prepare(DELETE_VEC_TURN).run(turnId);
  }

  async search(queryVector: Float32Array, k: number): Promise<ReadonlyArray<VectorSearchHit>> {
    const rows = this.db.prepare(SEARCH_VEC_TURNS).all(toBlob(queryVector), k) as Array<{
      turn_id: string;
      distance: number;
    }>;
    return rows.map((row) => ({ turnId: TurnId.from(row.turn_id), distance: row.distance }));
  }
}
