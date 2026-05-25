import { describe, it, expect } from 'vitest';
import { SessionSchema, TokenUsageSchema } from './Session.schema';
import type { SessionParsed } from './Session.schema';
import { SessionId } from '@asf/domain';
import type { Session } from '@asf/domain';

const validInput = {
  id: 'sess-1',
  tool: 'claude-code',
  sourceId: 'src',
  projectPath: null,
  projectName: null,
  gitBranch: null,
  startedAt: new Date(0),
  lastActivityAt: new Date(0),
  turnCount: 2,
  model: 'opus',
  tokenUsage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
  filePath: '/tmp/session.jsonl',
  fileMtime: 123,
  indexedAt: new Date(0),
};

describe('SessionSchema', () => {
  it('parses a valid session', () => {
    const parsed = SessionSchema.parse(validInput);
    expect(parsed.id).toBe('sess-1');
    expect(parsed.tokenUsage.inputTokens).toBe(1);
  });

  it('rejects an unknown tool', () => {
    expect(() => SessionSchema.parse({ ...validInput, tool: 'aider' })).toThrow();
  });

  it('rejects a negative turnCount', () => {
    expect(() => SessionSchema.parse({ ...validInput, turnCount: -1 })).toThrow();
  });

  it('aligns with the domain Session shape after branding the id', () => {
    const parsed: SessionParsed = SessionSchema.parse(validInput);
    const domain: Session = { ...parsed, id: SessionId.from(parsed.id) };
    expect(domain.id).toBe('sess-1');
  });
});

describe('TokenUsageSchema', () => {
  it('rejects a non-integer token count', () => {
    expect(() =>
      TokenUsageSchema.parse({
        inputTokens: 1.5,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheCreationTokens: 0,
      }),
    ).toThrow();
  });
});
