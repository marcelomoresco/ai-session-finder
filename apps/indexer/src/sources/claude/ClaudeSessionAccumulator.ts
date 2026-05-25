import { basename } from 'node:path';
import type { FileOperation, TurnRole } from '@asf/domain';
import type { RawSession, RawTurn } from '../RawSession';
import type { ClaudeMessage } from './ClaudeJsonlEvent';
import type { ClaudeJsonlEvent } from './ClaudeJsonlEvent';

const FILE_TOOLS: Readonly<Record<string, FileOperation>> = {
  Read: 'read',
  Write: 'write',
  Edit: 'edit',
  MultiEdit: 'edit',
  NotebookEdit: 'edit',
};

interface ToolCall {
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
  readonly result: string | null;
}

interface FileTouched {
  readonly path: string;
  readonly operation: FileOperation;
}

/** Accumulates Claude Code JSONL events line by line into one RawSession. */
export class ClaudeSessionAccumulator {
  private sessionId: string | null = null;
  private cwd: string | null = null;
  private gitBranch: string | null = null;
  private startedAt: Date | null = null;
  private lastActivityAt: Date | null = null;
  private model: string | null = null;
  private readonly tokens = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  private readonly turns: RawTurn[] = [];

  constructor(
    private readonly filePath: string,
    private readonly fileMtime: number,
  ) {}

  consume(event: ClaudeJsonlEvent): void {
    if (event.sessionId && this.sessionId === null) {
      this.sessionId = event.sessionId;
    }
    if (event.cwd && this.cwd === null) {
      this.cwd = event.cwd;
    }
    if (event.gitBranch && this.gitBranch === null) {
      this.gitBranch = event.gitBranch;
    }

    const ts = this.parseTimestamp(event.timestamp);
    if (ts !== null) {
      if (this.startedAt === null || ts < this.startedAt) {
        this.startedAt = ts;
      }
      if (this.lastActivityAt === null || ts > this.lastActivityAt) {
        this.lastActivityAt = ts;
      }
    }

    if (event.message) {
      this.consumeMessage(event.message, ts ?? this.lastActivityAt ?? new Date(0));
    }
  }

  finalize(): RawSession {
    if (this.sessionId === null) {
      throw new Error('No sessionId found in file');
    }
    return {
      tool: 'claude-code',
      sourceId: this.sessionId,
      projectPath: this.cwd,
      projectName: this.cwd !== null ? basename(this.cwd) : null,
      gitBranch: this.gitBranch,
      startedAt: this.startedAt ?? new Date(0),
      lastActivityAt: this.lastActivityAt ?? new Date(0),
      model: this.model,
      tokenUsage: {
        inputTokens: this.tokens.input,
        outputTokens: this.tokens.output,
        cacheReadTokens: this.tokens.cacheRead,
        cacheCreationTokens: this.tokens.cacheCreation,
      },
      filePath: this.filePath,
      fileMtime: this.fileMtime,
      turns: this.turns,
    };
  }

  private parseTimestamp(value: string | undefined): Date | null {
    if (value === undefined) {
      return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  private consumeMessage(message: ClaudeMessage, timestamp: Date): void {
    if (message.model && this.model === null) {
      this.model = message.model;
    }
    if (message.usage) {
      this.tokens.input += message.usage.input_tokens ?? 0;
      this.tokens.output += message.usage.output_tokens ?? 0;
      this.tokens.cacheRead += message.usage.cache_read_input_tokens ?? 0;
      this.tokens.cacheCreation += message.usage.cache_creation_input_tokens ?? 0;
    }

    const { text, toolCalls, filesTouched } = this.extractContent(message.content);
    this.turns.push({
      index: this.turns.length,
      role: toTurnRole(message.role),
      contentText: text,
      toolCalls,
      filesTouched,
      timestamp,
    });
  }

  private extractContent(content: ClaudeMessage['content']): {
    text: string;
    toolCalls: ReadonlyArray<ToolCall>;
    filesTouched: ReadonlyArray<FileTouched>;
  } {
    if (typeof content === 'string') {
      return { text: content, toolCalls: [], filesTouched: [] };
    }
    if (content === undefined) {
      return { text: '', toolCalls: [], filesTouched: [] };
    }

    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];
    const filesTouched: FileTouched[] = [];

    for (const block of content) {
      if (block.type === 'text' && block.text !== undefined) {
        textParts.push(block.text);
      } else if (block.type === 'thinking' && block.thinking !== undefined) {
        textParts.push(block.thinking);
      } else if (block.type === 'tool_use' && block.name !== undefined) {
        const input = block.input ?? {};
        toolCalls.push({ name: block.name, input, result: null });
        const touched = fileTouchedFrom(block.name, input);
        if (touched !== null) {
          filesTouched.push(touched);
        }
      }
    }

    return { text: textParts.join('\n'), toolCalls, filesTouched };
  }
}

function toTurnRole(role: string | undefined): TurnRole {
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

function fileTouchedFrom(
  name: string,
  input: Readonly<Record<string, unknown>>,
): FileTouched | null {
  const operation = FILE_TOOLS[name];
  if (operation === undefined) {
    return null;
  }
  const rawPath = name === 'NotebookEdit' ? input['notebook_path'] : input['file_path'];
  if (typeof rawPath !== 'string' || rawPath.length === 0) {
    return null;
  }
  return { path: rawPath, operation };
}
