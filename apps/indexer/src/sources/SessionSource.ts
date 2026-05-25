import type { Tool } from '@asf/domain';
import type { RawSession } from './RawSession';

export interface SessionSource {
  readonly tool: Tool;

  /** Root directories to watch (chokidar in Sprint 03). May not exist yet. */
  watchPaths(): ReadonlyArray<string>;

  /** Fast (regex/extension, no I/O) check of whether this source owns a file. */
  matches(filePath: string): boolean;

  /** Parse a file into 0+ RawSessions (async iterable — Cursor emits many). */
  parse(filePath: string): AsyncIterable<RawSession>;
}
