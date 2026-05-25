import { describe, it, expect } from 'vitest';
import type { SessionSource } from './SessionSource';
import type { RawSession } from './RawSession';

async function* asyncIterableOf<T>(items: ReadonlyArray<T>): AsyncGenerator<T> {
  await Promise.resolve();
  for (const item of items) {
    yield item;
  }
}

// A minimal mock proves the interface is implementable.
const mock: SessionSource = {
  tool: 'claude-code',
  watchPaths: () => ['/tmp/watch'],
  matches: (filePath) => filePath.endsWith('.jsonl'),
  parse: () => asyncIterableOf<RawSession>([]),
};

describe('SessionSource', () => {
  it('is implementable by a minimal mock', async () => {
    expect(mock.tool).toBe('claude-code');
    expect(mock.matches('/x/a.jsonl')).toBe(true);
    expect(mock.matches('/x/a.txt')).toBe(false);
    expect(mock.watchPaths()).toEqual(['/tmp/watch']);

    const sessions: RawSession[] = [];
    for await (const session of mock.parse('/x/a.jsonl')) {
      sessions.push(session);
    }
    expect(sessions).toEqual([]);
  });
});
