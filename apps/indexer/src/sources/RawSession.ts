import type { FileOperation, TokenUsage, Tool, TurnRole } from '@asf/domain';

/** A turn before normalization into the domain `Turn` (no branded ids yet). */
export interface RawTurn {
  readonly index: number;
  readonly role: TurnRole;
  readonly contentText: string;
  readonly toolCalls: ReadonlyArray<{
    readonly name: string;
    readonly input: Readonly<Record<string, unknown>>;
    readonly result: string | null;
  }>;
  readonly filesTouched: ReadonlyArray<{
    readonly path: string;
    readonly operation: FileOperation;
  }>;
  readonly timestamp: Date;
}

/**
 * A session as read from a source file, before normalization into the domain
 * `Session`. Has no `SessionId` — the pipeline derives that from `tool + sourceId`.
 */
export interface RawSession {
  readonly tool: Tool;
  readonly sourceId: string;
  readonly projectPath: string | null;
  readonly projectName: string | null;
  readonly gitBranch: string | null;
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly model: string | null;
  readonly tokenUsage: TokenUsage;
  readonly filePath: string;
  readonly fileMtime: number;
  readonly turns: ReadonlyArray<RawTurn>;
}
