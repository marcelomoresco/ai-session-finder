import { describe, it, expect } from 'vitest';
import { SessionId } from './Session';
import type { Session, TokenUsage } from './Session';

function makeSession(overrides: Partial<Session> = {}): Session {
  const tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };
  return {
    id: SessionId.from('sess-1'),
    tool: 'claude-code',
    sourceId: 'source-1',
    projectPath: null,
    projectName: null,
    gitBranch: null,
    startedAt: new Date(0),
    lastActivityAt: new Date(0),
    turnCount: 0,
    model: null,
    tokenUsage,
    filePath: '/tmp/session.jsonl',
    fileMtime: 0,
    indexedAt: new Date(0),
    ...overrides,
  };
}

describe('SessionId.from', () => {
  it('returns the value branded as a SessionId', () => {
    expect(SessionId.from('sess-1')).toBe('sess-1');
  });

  it('throws on an empty string', () => {
    expect(() => SessionId.from('')).toThrow('SessionId cannot be empty');
  });
});

describe('Session', () => {
  it('is readonly at the type level', () => {
    const session = makeSession();
    // @ts-expect-error id is readonly
    session.id = SessionId.from('other');
    // @ts-expect-error nested token usage is readonly
    session.tokenUsage.inputTokens = 5;
    expect(session.tool).toBe('claude-code');
  });
});
