import type { Session, SessionId, Tool, Turn } from '@asf/domain';

export interface SessionListFilter {
  readonly tools?: ReadonlyArray<Tool>;
  readonly projectPath?: string;
  readonly limit?: number;
  readonly offset?: number;
}

export interface SessionReader {
  findById(id: SessionId): Promise<Session | null>;
  findByToolAndSourceId(tool: Tool, sourceId: string): Promise<Session | null>;
  list(filter: SessionListFilter): Promise<ReadonlyArray<Session>>;
  countAll(): Promise<number>;
}

/**
 * Reads turns. Separate from SessionReader (ISP) so callers needing only session
 * metadata don't depend on turn loading. SQLiteRepository implements both.
 */
export interface TurnReader {
  listBySession(sessionId: SessionId): Promise<ReadonlyArray<Turn>>;
}
