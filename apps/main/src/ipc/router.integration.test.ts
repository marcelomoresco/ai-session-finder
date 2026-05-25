import { describe, it, expect } from 'vitest';
import superjson from 'superjson';
import { createInMemoryDatabase } from '../persistence/createDatabase';
import { SilentLogger } from '../observability/Logger';
import { createAppContext } from '../AppContext';
import type { WorkerHandle } from '../services/IndexerService';
import type { MainToWorker } from '../services/WorkerProtocol';
import { createTrpcContext } from './createContext';
import { appRouter } from './router';
import { createCallerFactory } from './trpc';
import { handleTrpcRequest } from './handleTrpcRequest';

function setup() {
  const posted: MainToWorker[] = [];
  const worker: WorkerHandle = {
    postMessage(message): void {
      posted.push(message);
    },
    on(): void {},
    terminate(): Promise<number> {
      return Promise.resolve(0);
    },
  };
  const app = createAppContext({
    databaseHandle: createInMemoryDatabase(),
    createWorker: () => worker,
    logger: new SilentLogger(),
  });
  return { app, ctx: createTrpcContext(app), posted };
}

const caller = createCallerFactory(appRouter);

describe('appRouter (integration, in-memory SQLite)', () => {
  it('search.query reaches the real service stack', async () => {
    const { app, ctx } = setup();
    const results = await caller(ctx).search.query({
      text: 'nothing here',
      mode: 'quick',
      filters: {},
      limit: 10,
    });
    expect(results).toEqual([]);
    await app.close();
  });

  it('session.list returns [] on an empty database', async () => {
    const { app, ctx } = setup();
    expect(await caller(ctx).session.list({})).toEqual([]);
    await app.close();
  });

  it('session.get returns null for an unknown id', async () => {
    const { app, ctx } = setup();
    expect(await caller(ctx).session.get({ id: 'missing' })).toBeNull();
    await app.close();
  });

  it('resume.buildCommand returns null for an unknown session', async () => {
    const { app, ctx } = setup();
    expect(await caller(ctx).resume.buildCommand({ sessionId: 'missing' })).toBeNull();
    await app.close();
  });

  it('session.list accepts all filter operators', async () => {
    const { app, ctx } = setup();
    const results = await caller(ctx).session.list({
      tools: ['cursor'],
      projectPath: '/p',
      limit: 5,
      offset: 0,
    });
    expect(results).toEqual([]);
    await app.close();
  });

  it('indexer procedures drive the worker through the service', async () => {
    const { app, ctx, posted } = setup();
    await caller(ctx).indexer.start();
    await caller(ctx).indexer.fullReindex();
    await caller(ctx).indexer.stop();
    expect(posted.map((m) => m.type)).toEqual(['start', 'fullReindex', 'stop']);
    await app.close();
  });

  it('handleTrpcRequest round-trips input and output through superjson', async () => {
    const { app, ctx } = setup();
    const input = { text: 'x', mode: 'quick', filters: { after: new Date('2026-01-01') }, limit: 5 };

    const res = await handleTrpcRequest(ctx, {
      path: 'search.query',
      type: 'query',
      input: superjson.stringify(input),
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(superjson.parse(res.data)).toEqual([]);
    }
    await app.close();
  });

  it('returns a consistent error shape for an unknown procedure path', async () => {
    const { app, ctx } = setup();
    const res = await handleTrpcRequest(ctx, {
      path: 'search.nope',
      type: 'query',
      input: superjson.stringify({}),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('NOT_FOUND');
      expect(typeof res.error.message).toBe('string');
    }
    await app.close();
  });

  it('surfaces input validation errors as BAD_REQUEST', async () => {
    const { app, ctx } = setup();
    const res = await handleTrpcRequest(ctx, {
      path: 'search.query',
      type: 'query',
      input: superjson.stringify({ text: '' }),
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('BAD_REQUEST');
    }
    await app.close();
  });

  it('wraps a malformed request payload as INTERNAL_SERVER_ERROR', async () => {
    const { app, ctx } = setup();
    const res = await handleTrpcRequest(ctx, {
      path: 'search.query',
      type: 'query',
      input: 'not-valid-superjson{{',
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('INTERNAL_SERVER_ERROR');
    }
    await app.close();
  });
});
