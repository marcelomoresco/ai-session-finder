import type { Tool } from './Tool';

export type SessionId = string & { readonly __brand: 'SessionId' };

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheReadTokens: number;
  readonly cacheCreationTokens: number;
}

export interface Session {
  readonly id: SessionId;
  readonly tool: Tool;
  readonly sourceId: string;
  readonly projectPath: string | null;
  readonly projectName: string | null;
  readonly gitBranch: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly turnCount: number;
  readonly model: string | null;
  readonly tokenUsage: TokenUsage;
  readonly filePath: string;
  readonly fileMtime: number;
  readonly indexedAt: Date;
}

export const SessionId = {
  from(value: string): SessionId {
    if (value.length === 0) {
      throw new Error('SessionId cannot be empty');
    }
    return value as SessionId;
  },
};
