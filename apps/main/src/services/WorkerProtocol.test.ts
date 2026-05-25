import { describe, it, expect } from 'vitest';
import type { MainToWorker, WorkerToMain } from './WorkerProtocol';

describe('WorkerProtocol', () => {
  it('types main→worker control messages', () => {
    const messages = [
      { type: 'start' },
      { type: 'stop' },
      { type: 'fullReindex' },
    ] satisfies MainToWorker[];
    expect(messages.map((m) => m.type)).toEqual(['start', 'stop', 'fullReindex']);
  });

  it('types worker→main status messages', () => {
    const indexed = { type: 'sessionIndexed', sessionId: 'abc' } satisfies WorkerToMain;
    const progress = { type: 'progress', total: 10, done: 4 } satisfies WorkerToMain;
    expect(indexed.sessionId).toBe('abc');
    expect(progress.done).toBe(4);
  });
});
