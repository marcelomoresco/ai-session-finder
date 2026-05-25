import { basename } from 'node:path';
import type { TurnRole } from '@asf/domain';
import type { RawSession, RawTurn } from '../RawSession';
import type { CodexJsonlEvent } from './CodexJsonlEvent';

/**
 * Accumulates Codex CLI rollout events into one RawSession. The sourceId comes
 * from the filename (Codex does not embed it in events). Content extraction is
 * best-effort against an unconfirmed event schema — see CodexJsonlEvent.
 */
export class CodexSessionAccumulator {
  private cwd: string | null = null;
  private startedAt: Date | null = null;
  private lastActivityAt: Date | null = null;
  private model: string | null = null;
  private readonly tokens = { input: 0, output: 0, cacheRead: 0 };
  private readonly turns: RawTurn[] = [];

  constructor(
    private readonly filePath: string,
    private readonly fileMtime: number,
    private readonly sourceId: string,
  ) {}

  consume(event: CodexJsonlEvent): void {
    if (event.cwd && this.cwd === null) {
      this.cwd = event.cwd;
    }
    if (event.model && this.model === null) {
      this.model = event.model;
    }

    const ts = parseTimestamp(event.timestamp);
    if (ts !== null) {
      if (this.startedAt === null || ts < this.startedAt) {
        this.startedAt = ts;
      }
      if (this.lastActivityAt === null || ts > this.lastActivityAt) {
        this.lastActivityAt = ts;
      }
    }

    if (event.usage) {
      this.tokens.input += event.usage.input_tokens ?? 0;
      this.tokens.output += event.usage.output_tokens ?? 0;
      this.tokens.cacheRead += event.usage.cached_input_tokens ?? 0;
    }

    const text = extractText(event);
    if (event.role !== undefined && text !== null) {
      this.turns.push({
        index: this.turns.length,
        role: toTurnRole(event.role),
        contentText: text,
        toolCalls: [],
        filesTouched: [],
        timestamp: ts ?? this.lastActivityAt ?? new Date(0),
      });
    }
  }

  finalize(): RawSession {
    return {
      tool: 'codex-cli',
      sourceId: this.sourceId,
      projectPath: this.cwd,
      projectName: this.cwd !== null ? basename(this.cwd) : null,
      gitBranch: null,
      startedAt: this.startedAt ?? new Date(0),
      lastActivityAt: this.lastActivityAt ?? new Date(0),
      model: this.model,
      tokenUsage: {
        inputTokens: this.tokens.input,
        outputTokens: this.tokens.output,
        cacheReadTokens: this.tokens.cacheRead,
        cacheCreationTokens: 0,
      },
      filePath: this.filePath,
      fileMtime: this.fileMtime,
      turns: this.turns,
    };
  }
}

function parseTimestamp(value: string | undefined): Date | null {
  if (value === undefined) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toTurnRole(role: string): TurnRole {
  switch (role) {
    case 'user':
    case 'assistant':
    case 'system':
    case 'tool':
      return role;
    default:
      return 'assistant';
  }
}

function extractText(event: CodexJsonlEvent): string | null {
  if (typeof event.content === 'string') {
    return event.content;
  }
  if (Array.isArray(event.content)) {
    const parts = event.content.map((block) => block.text ?? '').filter((t) => t.length > 0);
    return parts.length > 0 ? parts.join('\n') : null;
  }
  if (typeof event.text === 'string') {
    return event.text;
  }
  return null;
}
