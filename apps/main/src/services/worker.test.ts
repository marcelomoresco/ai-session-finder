import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  NoopEmbedder,
  NoopLogger,
  SourceRegistry,
  type RawSession,
  type SessionSource,
} from '@asf/indexer';
import { createDatabase } from '../persistence/createDatabase';
import { runWorker, type WorkerPort } from './worker';
import type { MainToWorker, WorkerToMain } from './WorkerProtocol';

const SECRET = 'sk-abcdefghijklmnopqrstuvwxyz0123456789';

class FakeSource implements SessionSource {
  readonly tool = 'claude-code' as const;
  constructor(private readonly watchedDir: string) {}
  watchPaths(): ReadonlyArray<string> {
    return [this.watchedDir];
  }
  matches(filePath: string): boolean {
    return filePath.endsWith('.jsonl');
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async *parse(filePath: string): AsyncIterable<RawSession> {
    yield {
      tool: 'claude-code',
      sourceId: filePath,
      projectPath: '/Users/dev/p',
      projectName: 'p',
      gitBranch: 'main',
      startedAt: new Date(0),
      lastActivityAt: new Date(0),
      model: null,
      tokenUsage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
      filePath,
      fileMtime: Date.now(),
      turns: [
        {
          index: 0,
          role: 'assistant',
          contentText: `here is a leaked key ${SECRET} oops`,
          toolCalls: [],
          filesTouched: [],
          timestamp: new Date(0),
        },
      ],
    };
  }
}

class ThrowingSource implements SessionSource {
  readonly tool = 'claude-code' as const;
  constructor(private readonly watchedDir: string) {}
  watchPaths(): ReadonlyArray<string> {
    return [this.watchedDir];
  }
  matches(filePath: string): boolean {
    return filePath.endsWith('.jsonl');
  }
  parse(): AsyncIterable<RawSession> {
    throw new Error('parse failed');
  }
}

class FakePort implements WorkerPort {
  readonly sent: WorkerToMain[] = [];
  private listener: ((message: MainToWorker) => void) | null = null;
  postMessage(message: WorkerToMain): void {
    this.sent.push(message);
  }
  on(_event: 'message', listener: (message: MainToWorker) => void): void {
    this.listener = listener;
  }
  send(message: MainToWorker): void {
    this.listener?.(message);
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 8000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('timed out waiting for condition');
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

// Keep the DB out of the watched directory so SQLite WAL churn doesn't create
// a self-inflicted file-event storm.
let dbDir: string;
let watchDir: string;

beforeEach(() => {
  dbDir = mkdtempSync(join(tmpdir(), 'asf-worker-db-'));
  watchDir = mkdtempSync(join(tmpdir(), 'asf-worker-watch-'));
});

afterEach(() => {
  rmSync(dbDir, { recursive: true, force: true });
  rmSync(watchDir, { recursive: true, force: true });
});

describe('runWorker (integration)', () => {
  it('indexes watched files into its own DB (secrets redacted) and reports status', async () => {
    const port = new FakePort();
    const indexer = runWorker(port, {
      userDataDir: dbDir,
      logger: new NoopLogger(),
      registry: new SourceRegistry([new FakeSource(watchDir)]),
      embedder: new NoopEmbedder(),
    });

    writeFileSync(join(watchDir, 'session.jsonl'), 'trigger');
    port.send({ type: 'start' });

    await waitFor(() => port.sent.some((m) => m.type === 'sessionIndexed'));
    expect(port.sent.some((m) => m.type === 'ready')).toBe(true);

    // Rule #2: a SEPARATE connection reads (WAL concurrent) what the worker wrote.
    const verify = createDatabase(dbDir);
    const row = verify.db.prepare('SELECT content_text FROM turns LIMIT 1').get() as
      | { content_text: string }
      | undefined;
    expect(row?.content_text).toContain('[REDACTED_API_KEY]');
    expect(row?.content_text).not.toContain(SECRET);
    verify.close();

    await indexer.close();
  }, 15_000);

  it('re-indexes on fullReindex and shuts down cleanly on stop', async () => {
    const port = new FakePort();
    const indexer = runWorker(port, {
      userDataDir: dbDir,
      logger: new NoopLogger(),
      registry: new SourceRegistry([new FakeSource(watchDir)]),
      embedder: new NoopEmbedder(),
    });

    writeFileSync(join(watchDir, 'session.jsonl'), 'trigger');
    port.send({ type: 'start' });
    await waitFor(() => port.sent.filter((m) => m.type === 'sessionIndexed').length >= 1);

    port.send({ type: 'fullReindex' });
    await waitFor(() => port.sent.filter((m) => m.type === 'sessionIndexed').length >= 2);

    expect(() => port.send({ type: 'stop' })).not.toThrow();
    await indexer.close();
  }, 15_000);

  it('reports an error message when a source fails to parse', async () => {
    const port = new FakePort();
    const indexer = runWorker(port, {
      userDataDir: dbDir,
      logger: new NoopLogger(),
      registry: new SourceRegistry([new ThrowingSource(watchDir)]),
      embedder: new NoopEmbedder(),
    });

    writeFileSync(join(watchDir, 'broken.jsonl'), 'trigger');
    port.send({ type: 'start' });

    await waitFor(() => port.sent.some((m) => m.type === 'error'));
    expect(port.sent.find((m) => m.type === 'error')).toMatchObject({
      type: 'error',
      message: 'parse failed',
    });

    await indexer.close();
  }, 15_000);
});
