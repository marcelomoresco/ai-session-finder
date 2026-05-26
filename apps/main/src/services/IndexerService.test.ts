import { describe, it, expect, vi } from 'vitest';
import { SilentLogger } from '../observability/Logger';
import { IndexerService, type WorkerHandle } from './IndexerService';
import type { MainToWorker, WorkerToMain } from './WorkerProtocol';

class FakeWorker implements WorkerHandle {
  readonly posted: MainToWorker[] = [];
  terminated = false;
  private readonly handlers = new Map<string, (arg: unknown) => void>();

  postMessage(message: MainToWorker): void {
    this.posted.push(message);
  }
  on(event: 'message' | 'error' | 'exit', listener: (arg: unknown) => void): void {
    this.handlers.set(event, listener);
  }
  terminate(): Promise<number> {
    this.terminated = true;
    return Promise.resolve(0);
  }
  emit(event: string, arg?: unknown): void {
    this.handlers.get(event)?.(arg);
  }
}

describe('IndexerService', () => {
  it('spawns the worker once and posts start', () => {
    const worker = new FakeWorker();
    const factory = vi.fn(() => worker);
    const service = new IndexerService(factory, {}, new SilentLogger());

    service.start();
    service.start();

    expect(factory).toHaveBeenCalledTimes(1);
    expect(worker.posted).toContainEqual({ type: 'start' });
  });

  it('routes worker→main messages to callbacks', () => {
    const worker = new FakeWorker();
    const onReady = vi.fn();
    const onSessionIndexed = vi.fn();
    const onProgress = vi.fn();
    const onError = vi.fn();
    const service = new IndexerService(
      () => worker,
      { onReady, onSessionIndexed, onProgress, onError },
      new SilentLogger(),
    );

    service.start();
    worker.emit('message', { type: 'ready' } satisfies WorkerToMain);
    worker.emit('message', { type: 'sessionIndexed', sessionId: 'abc' } satisfies WorkerToMain);
    worker.emit('message', { type: 'progress', total: 10, done: 3 } satisfies WorkerToMain);
    worker.emit('message', { type: 'error', message: 'boom' } satisfies WorkerToMain);

    expect(onReady).toHaveBeenCalledOnce();
    expect(onSessionIndexed).toHaveBeenCalledWith('abc');
    expect(onProgress).toHaveBeenCalledWith(3, 10);
    expect(onError).toHaveBeenCalledWith('boom');
  });

  it('isolates a worker crash (error event) without throwing', () => {
    const worker = new FakeWorker();
    const onError = vi.fn();
    const service = new IndexerService(() => worker, { onError }, new SilentLogger());

    service.start();

    expect(() => worker.emit('error', new Error('thread died'))).not.toThrow();
    expect(onError).toHaveBeenCalledWith('thread died');
  });

  it('posts fullReindex to the worker', () => {
    const worker = new FakeWorker();
    const service = new IndexerService(() => worker, {}, new SilentLogger());

    service.start();
    service.fullReindex();

    expect(worker.posted).toContainEqual({ type: 'fullReindex' });
  });

  it('stop posts stop, terminates, and lets a fresh worker be spawned', async () => {
    const worker = new FakeWorker();
    const factory = vi.fn(() => worker);
    const service = new IndexerService(factory, {}, new SilentLogger());

    service.start();
    await service.stop();

    expect(worker.posted).toContainEqual({ type: 'stop' });
    expect(worker.terminated).toBe(true);

    service.start();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('stop is a no-op when never started', async () => {
    const service = new IndexerService(() => new FakeWorker(), {}, new SilentLogger());
    await expect(service.stop()).resolves.toBeUndefined();
  });

  it('restart respawns a running worker and is a no-op when not running', async () => {
    const factory = vi.fn(() => new FakeWorker());
    const service = new IndexerService(factory, {}, new SilentLogger());

    await service.restart();
    expect(factory).toHaveBeenCalledTimes(0);

    service.start();
    await service.restart();
    expect(factory).toHaveBeenCalledTimes(2);
  });
});
