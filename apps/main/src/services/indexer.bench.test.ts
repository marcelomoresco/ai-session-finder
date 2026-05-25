import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NoopEmbedder,
  NoopLogger,
  Pipeline,
  SourceRegistry,
  TurnChunker,
  type RawSession,
  type RawTurn,
  type SessionSource,
} from '@asf/indexer';
import { createDatabase, type DatabaseHandle } from '../persistence/createDatabase';
import { SQLiteRepository } from '../persistence/SQLiteRepository';

// Slow, perf-sensitive benchmark for the Sprint 03 Definition of Done. Gated so
// it never runs (or flakes) in the normal suite. Run with:
//   ASF_BENCH=1 pnpm vitest run apps/main/src/services/indexer.bench.test.ts
const RUN = process.env['ASF_BENCH'] === '1';
const SESSION_COUNT = 5000;

// --- Fixture generator (synthetic, deterministic) ---
function generateRawTurn(sessionIndex: number, turnIndex: number): RawTurn {
  const role = turnIndex % 2 === 0 ? 'user' : 'assistant';
  return {
    index: turnIndex,
    role,
    contentText: `Session ${sessionIndex} turn ${turnIndex}: ${'discussing the indexing pipeline and search relevance. '.repeat(6)}`,
    toolCalls:
      role === 'assistant'
        ? [{ name: 'read', input: { path: `/src/file${turnIndex}.ts` }, result: 'ok' }]
        : [],
    filesTouched: [],
    timestamp: new Date(1_700_000_000_000 + sessionIndex * 1000 + turnIndex),
  };
}

function generateRawSession(index: number, fileMtime: number): RawSession {
  return {
    tool: 'claude-code',
    sourceId: `bench-${index}`,
    projectPath: `/Users/dev/project-${index % 50}`,
    projectName: `project-${index % 50}`,
    gitBranch: 'main',
    startedAt: new Date(1_700_000_000_000 + index * 1000),
    lastActivityAt: new Date(1_700_000_000_000 + index * 1000 + 5000),
    model: 'claude',
    tokenUsage: { inputTokens: 100, outputTokens: 200, cacheReadTokens: 0, cacheCreationTokens: 0 },
    filePath: `/bench/session-${index}.jsonl`,
    fileMtime,
    turns: [0, 1, 2].map((t) => generateRawTurn(index, t)),
  };
}

class BenchSource implements SessionSource {
  readonly tool = 'claude-code' as const;
  private readonly byPath = new Map<string, RawSession>();
  constructor(sessions: ReadonlyArray<RawSession>) {
    for (const session of sessions) this.byPath.set(session.filePath, session);
  }
  set(session: RawSession): void {
    this.byPath.set(session.filePath, session);
  }
  watchPaths(): ReadonlyArray<string> {
    return [];
  }
  matches(filePath: string): boolean {
    return this.byPath.has(filePath);
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async *parse(filePath: string): AsyncIterable<RawSession> {
    const session = this.byPath.get(filePath);
    if (session) yield session;
  }
}

describe.skipIf(!RUN)('indexing benchmark (ASF_BENCH=1)', () => {
  let dir: string;
  let handle: DatabaseHandle | null;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asf-bench-'));
    handle = null;
  });

  afterEach(() => {
    handle?.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('indexes 5000 sessions < 2min and re-indexes one changed file < 300ms', async () => {
    const mtime = 1000;
    const sessions = Array.from({ length: SESSION_COUNT }, (_, i) => generateRawSession(i, mtime));
    const source = new BenchSource(sessions);
    handle = createDatabase(dir);
    const repo = new SQLiteRepository(handle.db);
    const pipeline = new Pipeline({
      registry: new SourceRegistry([source]),
      chunker: new TurnChunker(),
      embedder: new NoopEmbedder(),
      sessionWriter: repo,
      sessionReader: repo,
      vectorRepo: null,
      logger: new NoopLogger(),
      clock: () => new Date(),
    });

    const memBefore = process.memoryUsage();
    const start = performance.now();
    for (const session of sessions) {
      await pipeline.indexFile(session.filePath);
    }
    const fullMs = performance.now() - start;
    const memAfter = process.memoryUsage();

    expect(await repo.countAll()).toBe(SESSION_COUNT);
    expect(fullMs).toBeLessThan(120_000);

    // Incremental: one file changed (newer mtime) → single upsert.
    source.set(generateRawSession(0, mtime + 1));
    const incStart = performance.now();
    await pipeline.indexFile('/bench/session-0.jsonl');
    const incMs = performance.now() - incStart;
    expect(incMs).toBeLessThan(300);

    // Unchanged re-index is a pure skip (no write).
    const skipStart = performance.now();
    await pipeline.indexFile('/bench/session-1.jsonl');
    const skipMs = performance.now() - skipStart;

    const rssMb = memAfter.rss / 1024 / 1024;
    const heapDeltaMb = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
    // eslint-disable-next-line no-console
    console.log(
      `[bench] full=${fullMs.toFixed(0)}ms (${(fullMs / SESSION_COUNT).toFixed(2)}ms/session) ` +
        `incremental=${incMs.toFixed(1)}ms skip=${skipMs.toFixed(2)}ms ` +
        `rss=${rssMb.toFixed(0)}MB heapΔ=${heapDeltaMb.toFixed(0)}MB`,
    );
    expect(rssMb).toBeLessThan(800);
  }, 180_000);
});
