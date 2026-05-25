import type { Session, SessionId, Turn } from '@asf/domain';

export interface SessionWriter {
  upsert(session: Session, turns: ReadonlyArray<Turn>): Promise<void>;
  delete(id: SessionId): Promise<void>;
  pruneOrphans(): Promise<number>;
}
