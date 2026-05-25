import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Tool } from '@asf/domain';
import type { RawSession } from '../RawSession';
import type { SessionSource } from '../SessionSource';
import { readJsonLines } from '../../util/readJsonLines';
import { ClaudeJsonlEventSchema } from './ClaudeJsonlEvent';
import { ClaudeSessionAccumulator } from './ClaudeSessionAccumulator';

const CLAUDE_JSONL = /\/\.claude\/projects\/[^/]+\/[^/]+\.jsonl$/;

export class ClaudeCodeSource implements SessionSource {
  readonly tool: Tool = 'claude-code';

  watchPaths(): ReadonlyArray<string> {
    return [join(homedir(), '.claude', 'projects')];
  }

  matches(filePath: string): boolean {
    return CLAUDE_JSONL.test(filePath);
  }

  async *parse(filePath: string): AsyncIterable<RawSession> {
    const accumulator = new ClaudeSessionAccumulator(filePath, fileMtime(filePath));
    let consumed = false;

    for await (const raw of readJsonLines<unknown>(filePath)) {
      const parsed = ClaudeJsonlEventSchema.safeParse(raw);
      if (parsed.success) {
        accumulator.consume(parsed.data);
        consumed = true;
      }
    }

    if (consumed) {
      yield accumulator.finalize();
    }
  }
}

function fileMtime(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}
