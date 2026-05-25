import type { SessionSource } from './SessionSource';
import { ClaudeCodeSource } from './claude/ClaudeCodeSource';
import { CodexCliSource } from './codex/CodexCliSource';
import { CursorSource } from './cursor/CursorSource';

/** Routes a file path to the source that owns it and aggregates watch paths. */
export class SourceRegistry {
  constructor(private readonly sources: ReadonlyArray<SessionSource>) {}

  /** First source whose `matches()` claims the path, or null if none do. */
  findFor(filePath: string): SessionSource | null {
    return this.sources.find((source) => source.matches(filePath)) ?? null;
  }

  /** Every source's watch roots, flattened (for chokidar in Sprint 03). */
  allWatchPaths(): ReadonlyArray<string> {
    return this.sources.flatMap((source) => source.watchPaths());
  }

  all(): ReadonlyArray<SessionSource> {
    return this.sources;
  }
}

export function createDefaultRegistry(): SourceRegistry {
  return new SourceRegistry([new ClaudeCodeSource(), new CodexCliSource(), new CursorSource()]);
}
