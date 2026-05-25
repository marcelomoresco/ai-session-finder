import type { Session, SessionId, Turn, TurnId } from '@asf/domain';

/**
 * Persistence ports the indexer Pipeline depends on. Following the
 * ports-and-adapters / DIP pattern, the *consumer* (this app) owns these
 * abstractions; the concrete `@asf/main` repositories (SQLiteRepository,
 * SqliteVecRepository) satisfy them structurally, so the indexer never imports
 * the main app and no dependency cycle forms.
 *
 * Each port is intentionally minimal (Interface Segregation): only the methods
 * the Pipeline actually calls.
 */

export interface SessionReaderPort {
  findById(id: SessionId): Promise<Session | null>;
}

export interface SessionWriterPort {
  upsert(session: Session, turns: ReadonlyArray<Turn>): Promise<void>;
}

export interface VectorRecord {
  readonly turnId: TurnId;
  readonly embedding: Float32Array;
}

export interface VectorWriterPort {
  upsertBatch(items: ReadonlyArray<VectorRecord>): Promise<void>;
}
