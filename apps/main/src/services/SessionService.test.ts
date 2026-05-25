import { describe, it, expect, vi } from 'vitest';
import { SessionId, TurnId, type Session, type Turn } from '@asf/domain';
import type { SessionListFilter, SessionReader } from '../persistence/SessionReader';
import type { TurnReader } from '../persistence/SessionReader';
import { SessionService } from './SessionService';

function makeSession(id: string): Session {
  return {
    id: SessionId.from(id),
    tool: 'claude-code',
    sourceId: id,
    projectPath: '/repo',
    projectName: 'repo',
    gitBranch: 'main',
    startedAt: new Date(0),
    lastActivityAt: new Date(0),
    turnCount: 0,
    model: null,
    tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    filePath: '/s.jsonl',
    fileMtime: 0,
    indexedAt: new Date(0),
  };
}

function makeTurn(id: string, index: number): Turn {
  return {
    id: TurnId.from(id),
    sessionId: SessionId.from('s1'),
    index,
    role: 'user',
    contentText: 'x',
    toolCalls: [],
    filesTouched: [],
    timestamp: new Date(0),
  };
}

class FakeReader implements SessionReader {
  list = vi.fn((_filter: SessionListFilter): Promise<ReadonlyArray<Session>> => Promise.resolve([]));
  constructor(private readonly session: Session | null = null) {}
  findById(): Promise<Session | null> {
    return Promise.resolve(this.session);
  }
  findByToolAndSourceId(): Promise<Session | null> {
    return Promise.resolve(this.session);
  }
  countAll(): Promise<number> {
    return Promise.resolve(0);
  }
}

class FakeTurnReader implements TurnReader {
  listCalls = 0;
  constructor(private readonly turns: ReadonlyArray<Turn> = []) {}
  listBySession(): Promise<ReadonlyArray<Turn>> {
    this.listCalls += 1;
    return Promise.resolve(this.turns);
  }
}

describe('SessionService', () => {
  it('returns session + its turns when the session exists', async () => {
    const reader = new FakeReader(makeSession('s1'));
    const turnReader = new FakeTurnReader([makeTurn('t1', 0), makeTurn('t2', 1)]);
    const service = new SessionService(reader, turnReader);

    const detail = await service.findById(SessionId.from('s1'));

    expect(detail?.session.id).toBe('s1');
    expect(detail?.turns.map((t) => t.id)).toEqual(['t1', 't2']);
  });

  it('returns null and does not fetch turns when the session is missing', async () => {
    const reader = new FakeReader(null);
    const turnReader = new FakeTurnReader();
    const service = new SessionService(reader, turnReader);

    expect(await service.findById(SessionId.from('nope'))).toBeNull();
    expect(turnReader.listCalls).toBe(0);
  });

  it('delegates list to the reader with the given filter', async () => {
    const reader = new FakeReader();
    const service = new SessionService(reader, new FakeTurnReader());

    await service.list({ tools: ['cursor'], limit: 5 });

    expect(reader.list).toHaveBeenCalledWith({ tools: ['cursor'], limit: 5 });
  });
});
