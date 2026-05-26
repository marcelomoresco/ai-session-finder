import { describe, it, expect } from 'vitest';
import { IndexAdminService, type IndexAdminStore } from './IndexAdminService';

function fakeStore(over: Partial<IndexAdminStore> = {}): IndexAdminStore {
  return {
    countAll: () => Promise.resolve(0),
    lastIndexedAt: () => Promise.resolve(null),
    clearAll: () => Promise.resolve(),
    ...over,
  };
}

describe('IndexAdminService', () => {
  it('reports indexed count and lastSync from the store', async () => {
    const when = new Date('2026-05-25T10:00:00Z');
    const service = new IndexAdminService(
      fakeStore({
        countAll: () => Promise.resolve(42),
        lastIndexedAt: () => Promise.resolve(when),
      }),
    );
    expect(await service.stats()).toEqual({ indexed: 42, lastSync: when });
  });

  it('reports null lastSync on an empty index', async () => {
    const service = new IndexAdminService(fakeStore());
    expect(await service.stats()).toEqual({ indexed: 0, lastSync: null });
  });

  it('clears the index through the store', async () => {
    let cleared = 0;
    const service = new IndexAdminService(
      fakeStore({
        clearAll: () => {
          cleared += 1;
          return Promise.resolve();
        },
      }),
    );
    await service.clear();
    expect(cleared).toBe(1);
  });
});
