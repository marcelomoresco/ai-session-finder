import { basename } from 'node:path';
import type { TurnRole } from '@asf/domain';
import type { RawSession, RawTurn } from '../RawSession';
import type { CursorBubble, CursorComposerSession } from './CursorBubble';

export interface CursorMapContext {
  readonly filePath: string;
  readonly fileMtime: number;
  readonly projectPath: string | null;
}

/**
 * Maps one Cursor composer (its meta + ordered bubbles) into a RawSession.
 * This is the Cursor equivalent of the JSONL accumulators: best-effort against
 * an unconfirmed bubble/meta schema (see CursorBubble). Token usage is always
 * zero — Cursor does not expose it in the vscdb.
 */
export function composerToRawSession(
  session: CursorComposerSession,
  ctx: CursorMapContext,
): RawSession {
  const turns = session.bubbles.map((bubble, index) => bubbleToTurn(bubble, index));

  const bubbleTimes = session.bubbles
    .map((b) => b.createdAt)
    .filter((t): t is number => typeof t === 'number');

  const metaCreated = typeof session.meta.createdAt === 'number' ? session.meta.createdAt : null;
  const metaUpdated =
    typeof session.meta.lastUpdatedAt === 'number' ? session.meta.lastUpdatedAt : null;

  const startMs = bubbleTimes.length > 0 ? Math.min(...bubbleTimes) : metaCreated;
  const endMs =
    bubbleTimes.length > 0 ? Math.max(...bubbleTimes) : (metaUpdated ?? metaCreated);

  return {
    tool: 'cursor',
    sourceId: session.composerId,
    projectPath: ctx.projectPath,
    projectName: ctx.projectPath !== null ? basename(ctx.projectPath) : null,
    gitBranch: null,
    startedAt: startMs !== null ? new Date(startMs) : new Date(0),
    lastActivityAt: endMs !== null ? new Date(endMs) : new Date(0),
    model: session.meta.model ?? null,
    tokenUsage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    },
    filePath: ctx.filePath,
    fileMtime: ctx.fileMtime,
    turns,
  };
}

function bubbleToTurn(bubble: CursorBubble, index: number): RawTurn {
  return {
    index,
    role: resolveRole(bubble),
    contentText: bubble.text ?? bubble.richText ?? '',
    toolCalls: [],
    filesTouched: [],
    timestamp: typeof bubble.createdAt === 'number' ? new Date(bubble.createdAt) : new Date(0),
  };
}

function resolveRole(bubble: CursorBubble): TurnRole {
  if (
    bubble.role === 'user' ||
    bubble.role === 'assistant' ||
    bubble.role === 'system' ||
    bubble.role === 'tool'
  ) {
    return bubble.role;
  }
  if (bubble.type === 1) return 'user';
  if (bubble.type === 2) return 'assistant';
  return 'assistant';
}
