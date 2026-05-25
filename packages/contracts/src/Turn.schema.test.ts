import { describe, it, expect } from 'vitest';
import { TurnSchema } from './Turn.schema';

const validTurn = {
  id: 't1',
  sessionId: 's1',
  index: 0,
  role: 'user',
  contentText: 'hi',
  toolCalls: [],
  filesTouched: [],
  timestamp: new Date(0),
};

describe('TurnSchema', () => {
  it('parses a valid turn', () => {
    const parsed = TurnSchema.parse(validTurn);
    expect(parsed.role).toBe('user');
  });

  it('rejects an unknown role', () => {
    expect(() => TurnSchema.parse({ ...validTurn, role: 'bot' })).toThrow();
  });

  it('parses tool calls and files touched', () => {
    const parsed = TurnSchema.parse({
      ...validTurn,
      toolCalls: [{ name: 'Edit', input: { path: '/x' }, result: 'ok' }],
      filesTouched: [{ path: '/x', operation: 'edit' }],
    });
    expect(parsed.toolCalls[0]?.name).toBe('Edit');
    expect(parsed.filesTouched[0]?.operation).toBe('edit');
  });

  it('rejects an invalid file operation', () => {
    expect(() =>
      TurnSchema.parse({ ...validTurn, filesTouched: [{ path: '/x', operation: 'delete' }] }),
    ).toThrow();
  });
});
