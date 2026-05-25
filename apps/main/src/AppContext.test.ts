import { describe, it, expect } from 'vitest';
import { createInMemoryDatabase } from './persistence/createDatabase';
import { SilentLogger } from './observability/Logger';
import type { WorkerHandle } from './services/IndexerService';
import { createAppContext } from './AppContext';

const fakeWorker = (): WorkerHandle => ({
  postMessage(): void {},
  on(): void {},
  terminate(): Promise<number> {
    return Promise.resolve(0);
  },
});

describe('createAppContext', () => {
  it('wires every service and runs end-to-end on an in-memory database', async () => {
    const handle = createInMemoryDatabase();
    const ctx = createAppContext({
      databaseHandle: handle,
      createWorker: fakeWorker,
      logger: new SilentLogger(),
    });

    expect(ctx.searchService).toBeDefined();
    expect(ctx.sessionService).toBeDefined();
    expect(ctx.resumeService).toBeDefined();
    expect(ctx.indexerService).toBeDefined();

    expect(
      await ctx.searchService.search({ text: 'anything', mode: 'quick', filters: {}, limit: 10 }),
    ).toEqual([]);
    expect(await ctx.sessionService.list({})).toEqual([]);

    await ctx.close();
    expect(handle.db.open).toBe(false);
  });

  it('degrades gracefully (no crash) when sqlite-vec is unavailable', async () => {
    const handle = createInMemoryDatabase(() => {
      throw new Error('sqlite-vec unavailable');
    });
    const ctx = createAppContext({
      databaseHandle: handle,
      createWorker: fakeWorker,
      logger: new SilentLogger(),
    });

    // smart mode falls back to quick because the embedder is the no-op fallback.
    expect(
      await ctx.searchService.search({ text: 'x', mode: 'smart', filters: {}, limit: 10 }),
    ).toEqual([]);

    await ctx.close();
  });
});
