import { describe, it, expect } from 'vitest';
import { TurnId } from './Turn';
import type { Turn } from './Turn';
import { SessionId } from './Session';

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    id: TurnId.from('turn-1'),
    sessionId: SessionId.from('sess-1'),
    index: 0,
    role: 'user',
    contentText: 'hello world',
    toolCalls: [],
    filesTouched: [],
    timestamp: new Date(0),
    ...overrides,
  };
}

describe('TurnId.from', () => {
  it('returns the value branded as a TurnId', () => {
    expect(TurnId.from('turn-1')).toBe('turn-1');
  });

  it('throws on an empty string', () => {
    expect(() => TurnId.from('')).toThrow('TurnId cannot be empty');
  });
});

describe('Turn', () => {
  it('is readonly at the type level', () => {
    const turn = makeTurn();
    // @ts-expect-error role is readonly
    turn.role = 'assistant';
    // @ts-expect-error toolCalls is readonly
    turn.toolCalls = [];
    expect(turn.index).toBe(0);
  });
});
