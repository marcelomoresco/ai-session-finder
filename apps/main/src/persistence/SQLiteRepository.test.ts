import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { Migrator } from './migrations/Migrator';
import { migrations } from './migrations/index';
import { SQLiteRepository } from './SQLiteRepository';
import { SessionId, TurnId } from '@asf/domain';
import type { Session, Turn } from '@asf/domain';

function makeSession(over: Partial<Session> = {}): Session {
  return {
    id: SessionId.from('sess-1'),
    tool: 'claude-code',
    sourceId: 'source-1',
    projectPath: '/repo',
    projectName: 'repo',
    gitBranch: 'main',
    startedAt: new Date(1000),
    lastActivityAt: new Date(2000),
    turnCount: 1,
    model: 'opus',
    tokenUsage: { inputTokens: 10, outputTokens: 20, cacheReadTokens: 1, cacheCreationTokens: 2 },
    filePath: '/tmp/s.jsonl',
    fileMtime: 5,
    indexedAt: new Date(3000),
    ...over,
  };
}

function makeTurn(over: Partial<Turn> = {}): Turn {
  return {
    id: TurnId.from('turn-1'),
    sessionId: SessionId.from('sess-1'),
    index: 0,
    role: 'user',
    contentText: 'hello world',
    toolCalls: [],
    filesTouched: [],
    timestamp: new Date(1500),
    ...over,
  };
}

let db: Database.Database;
let repo: SQLiteRepository;

beforeEach(() => {
  db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  new Migrator(db, migrations).run();
  repo = new SQLiteRepository(db);
});

afterEach(() => {
  db.close();
});

describe('SQLiteRepository — read/write', () => {
  it('upserts a session and reads it back with branded ids and mapped fields', async () => {
    await repo.upsert(makeSession(), [makeTurn()]);
    const found = await repo.findById(SessionId.from('sess-1'));
    expect(found).not.toBeNull();
    expect(found?.id).toBe('sess-1');
    expect(found?.tool).toBe('claude-code');
    expect(found?.projectName).toBe('repo');
    expect(found?.tokenUsage).toEqual({
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 1,
      cacheCreationTokens: 2,
    });
    expect(found?.startedAt.getTime()).toBe(1000);
    expect(found?.indexedAt.getTime()).toBe(3000);
  });

  it('returns null for a missing id', async () => {
    expect(await repo.findById(SessionId.from('nope'))).toBeNull();
  });

  it('finds by tool and source id', async () => {
    await repo.upsert(makeSession(), []);
    expect((await repo.findByToolAndSourceId('claude-code', 'source-1'))?.id).toBe('sess-1');
    expect(await repo.findByToolAndSourceId('cursor', 'source-1')).toBeNull();
  });

  it('updates on id conflict and replaces turns', async () => {
    await repo.upsert(makeSession({ turnCount: 1 }), [
      makeTurn({ id: TurnId.from('t1'), index: 0 }),
    ]);
    await repo.upsert(makeSession({ turnCount: 2, lastActivityAt: new Date(9999) }), [
      makeTurn({ id: TurnId.from('t2'), index: 0 }),
      makeTurn({ id: TurnId.from('t3'), index: 1 }),
    ]);
    const found = await repo.findById(SessionId.from('sess-1'));
    expect(found?.turnCount).toBe(2);
    expect(found?.lastActivityAt.getTime()).toBe(9999);
    const turns = db
      .prepare('SELECT id FROM turns WHERE session_id = ? ORDER BY turn_index')
      .all('sess-1') as Array<{ id: string }>;
    expect(turns.map((t) => t.id)).toEqual(['t2', 't3']);
  });

  it('counts all sessions', async () => {
    await repo.upsert(makeSession({ id: SessionId.from('a'), sourceId: 'a' }), []);
    await repo.upsert(makeSession({ id: SessionId.from('b'), sourceId: 'b' }), []);
    expect(await repo.countAll()).toBe(2);
  });

  it('persists tool calls as JSON and files touched', async () => {
    await repo.upsert(makeSession(), [
      makeTurn({
        id: TurnId.from('t1'),
        toolCalls: [{ name: 'Edit', input: { path: '/x' }, result: 'ok' }],
        filesTouched: [{ path: '/x', operation: 'edit' }],
      }),
    ]);
    const row = db.prepare('SELECT tool_calls FROM turns WHERE id = ?').get('t1') as {
      tool_calls: string;
    };
    expect(JSON.parse(row.tool_calls)).toEqual([
      { name: 'Edit', input: { path: '/x' }, result: 'ok' },
    ]);
    const files = db
      .prepare('SELECT file_path, operation FROM files_touched WHERE turn_id = ?')
      .all('t1');
    expect(files).toEqual([{ file_path: '/x', operation: 'edit' }]);
  });

  it('deletes a session and cascades to its turns', async () => {
    await repo.upsert(makeSession(), [makeTurn({ id: TurnId.from('t1') })]);
    await repo.delete(SessionId.from('sess-1'));
    expect(await repo.findById(SessionId.from('sess-1'))).toBeNull();
    const turns = db.prepare('SELECT COUNT(*) AS c FROM turns').get() as { c: number };
    expect(turns.c).toBe(0);
  });

  it('pruneOrphans is a no-op placeholder', async () => {
    expect(await repo.pruneOrphans()).toBe(0);
  });
});

describe('SQLiteRepository — upsert atomicity', () => {
  it('rolls back, preserving prior state, when turns violate a constraint', async () => {
    await repo.upsert(makeSession({ turnCount: 1 }), [
      makeTurn({ id: TurnId.from('t1'), index: 0 }),
    ]);
    await expect(
      repo.upsert(makeSession({ turnCount: 99 }), [
        makeTurn({ id: TurnId.from('t2'), index: 0 }),
        makeTurn({ id: TurnId.from('t3'), index: 0 }),
      ]),
    ).rejects.toThrow();
    const found = await repo.findById(SessionId.from('sess-1'));
    expect(found?.turnCount).toBe(1);
    const turns = db.prepare('SELECT id FROM turns WHERE session_id = ?').all('sess-1') as Array<{
      id: string;
    }>;
    expect(turns.map((t) => t.id)).toEqual(['t1']);
  });
});

describe('SQLiteRepository — list & search', () => {
  beforeEach(async () => {
    await repo.upsert(
      makeSession({
        id: SessionId.from('a'),
        sourceId: 'a',
        tool: 'claude-code',
        projectPath: '/p1',
        lastActivityAt: new Date(100),
      }),
      [makeTurn({ id: TurnId.from('ta'), sessionId: SessionId.from('a'), contentText: 'hello' })],
    );
    await repo.upsert(
      makeSession({
        id: SessionId.from('b'),
        sourceId: 'b',
        tool: 'cursor',
        projectPath: '/p2',
        lastActivityAt: new Date(300),
      }),
      [
        makeTurn({
          id: TurnId.from('tb'),
          sessionId: SessionId.from('b'),
          contentText: 'race race race everywhere',
        }),
      ],
    );
    await repo.upsert(
      makeSession({
        id: SessionId.from('c'),
        sourceId: 'c',
        tool: 'claude-code',
        projectPath: '/p1',
        lastActivityAt: new Date(200),
      }),
      [
        makeTurn({
          id: TurnId.from('tc'),
          sessionId: SessionId.from('c'),
          contentText: 'fix the race condition in the scheduler',
        }),
      ],
    );
  });

  it('lists sessions ordered by last activity desc', async () => {
    const all = await repo.list({});
    expect(all.map((s) => s.id)).toEqual(['b', 'c', 'a']);
  });

  it('filters list by tool', async () => {
    const claude = await repo.list({ tools: ['claude-code'] });
    expect(claude.map((s) => s.id)).toEqual(['c', 'a']);
  });

  it('filters list by project path and respects limit', async () => {
    expect((await repo.list({ projectPath: '/p2' })).map((s) => s.id)).toEqual(['b']);
    expect(await repo.list({ limit: 1 })).toHaveLength(1);
  });

  it('searches turns via FTS ordered by rank (most relevant first)', async () => {
    const results = await repo.search({ text: 'race', mode: 'quick', filters: {}, limit: 10 });
    expect(results).toHaveLength(2);
    expect(results[0]?.turnId).toBe('tb');
    expect(results[0]?.snippet).toContain('race');
  });

  it('applies tool filter to search', async () => {
    const results = await repo.search({
      text: 'race',
      mode: 'quick',
      filters: { tools: ['claude-code'] },
      limit: 10,
    });
    expect(results.map((r) => r.turnId)).toEqual(['tc']);
  });

  it('returns an empty array when nothing matches', async () => {
    expect(
      await repo.search({ text: 'zzznotfound', mode: 'quick', filters: {}, limit: 10 }),
    ).toEqual([]);
  });

  it('filters search by an after date', async () => {
    const results = await repo.search({
      text: 'race',
      mode: 'quick',
      filters: { after: new Date(250) },
      limit: 10,
    });
    expect(results.map((r) => r.turnId)).toEqual(['tb']);
  });

  it('filters search by a before date', async () => {
    const results = await repo.search({
      text: 'race',
      mode: 'quick',
      filters: { before: new Date(250) },
      limit: 10,
    });
    expect(results.map((r) => r.turnId)).toEqual(['tc']);
  });

  it('paginates list with limit and offset', async () => {
    const page = await repo.list({ limit: 1, offset: 1 });
    expect(page.map((s) => s.id)).toEqual(['c']);
  });
});

describe('SQLiteRepository — TurnReader', () => {
  it('lists turns ordered by index, reconstructing tool calls and files touched', async () => {
    await repo.upsert(makeSession(), [
      makeTurn({ id: TurnId.from('t2'), index: 1, contentText: 'second' }),
      makeTurn({
        id: TurnId.from('t1'),
        index: 0,
        contentText: 'first',
        toolCalls: [{ name: 'Edit', input: { path: '/x' }, result: 'ok' }],
        filesTouched: [{ path: '/x', operation: 'edit' }],
      }),
    ]);

    const turns = await repo.listBySession(SessionId.from('sess-1'));

    expect(turns.map((t) => t.id)).toEqual(['t1', 't2']);
    expect(turns[0]!.contentText).toBe('first');
    expect(turns[0]!.toolCalls).toEqual([{ name: 'Edit', input: { path: '/x' }, result: 'ok' }]);
    expect(turns[0]!.filesTouched).toEqual([{ path: '/x', operation: 'edit' }]);
    expect(turns[0]!.timestamp).toBeInstanceOf(Date);
    expect(turns[1]!.toolCalls).toEqual([]);
  });

  it('returns an empty array for a session with no turns', async () => {
    await repo.upsert(makeSession(), []);
    expect(await repo.listBySession(SessionId.from('sess-1'))).toEqual([]);
  });
});
