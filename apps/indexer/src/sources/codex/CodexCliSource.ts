import { statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';
import type { Tool } from '@asf/domain';
import type { RawSession } from '../RawSession';
import type { SessionSource } from '../SessionSource';
import { readJsonLines } from '../../util/readJsonLines';
import { CodexJsonlEventSchema } from './CodexJsonlEvent';
import { CodexSessionAccumulator } from './CodexSessionAccumulator';

const CODEX_ROLLOUT = /\/\.codex\/sessions\/\d{4}\/\d{2}\/\d{2}\/rollout-.+\.jsonl$/;

export class CodexCliSource implements SessionSource {
  readonly tool: Tool = 'codex-cli';

  watchPaths(): ReadonlyArray<string> {
    return [join(homedir(), '.codex', 'sessions')];
  }

  matches(filePath: string): boolean {
    return CODEX_ROLLOUT.test(filePath);
  }

  async *parse(filePath: string): AsyncIterable<RawSession> {
    const accumulator = new CodexSessionAccumulator(
      filePath,
      fileMtime(filePath),
      extractSourceId(filePath),
    );
    let consumed = false;

    for await (const raw of readJsonLines<unknown>(filePath)) {
      const parsed = CodexJsonlEventSchema.safeParse(raw);
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

/** Extracts the trailing id from `rollout-<timestamp>-<id>.jsonl`. */
export function extractSourceId(filePath: string): string {
  const base = basename(filePath, '.jsonl');
  const match = base.match(/rollout-.+-([a-z0-9]+)$/i);
  return match?.[1] ?? base;
}

function fileMtime(filePath: string): number {
  try {
    return statSync(filePath).mtimeMs;
  } catch {
    return 0;
  }
}
