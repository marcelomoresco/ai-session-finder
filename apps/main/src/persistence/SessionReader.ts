import type { Session, SessionId, Tool } from '@asf/domain';

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
