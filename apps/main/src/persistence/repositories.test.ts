import { describe, it, expect } from 'vitest';
import type { SessionReader, SessionListFilter } from './SessionReader';
import type { SessionWriter } from './SessionWriter';
import type { SearchableRepository } from './SearchableRepository';
import { SessionId } from '@asf/domain';
import type { Session, Turn, SearchResult } from '@asf/domain';

// Stub implementations prove the interfaces are well-formed and implementable.
const reader: SessionReader = {
  findById: () => Promise.resolve(null),
  findByToolAndSourceId: () => Promise.resolve(null),
  list: (_filter: SessionListFilter) => Promise.resolve<ReadonlyArray<Session>>([]),
  countAll: () => Promise.resolve(0),
};

const writer: SessionWriter = {
  upsert: (_session: Session, _turns: ReadonlyArray<Turn>) => Promise.resolve(),
  delete: () => Promise.resolve(),
  pruneOrphans: () => Promise.resolve(0),
};

const searchable: SearchableRepository = {
  search: () => Promise.resolve<ReadonlyArray<SearchResult>>([]),
};

describe('repository interfaces', () => {
  it('SessionReader is implementable', async () => {
    expect(await reader.countAll()).toBe(0);
    expect(await reader.findById(SessionId.from('x'))).toBeNull();
    expect(await reader.list({})).toEqual([]);
  });

  it('SessionWriter is implementable', async () => {
    expect(typeof writer.upsert).toBe('function');
    await writer.delete(SessionId.from('x'));
    expect(await writer.pruneOrphans()).toBe(0);
  });

  it('SearchableRepository is implementable', async () => {
    const results = await searchable.search({ text: 'x', mode: 'quick', filters: {}, limit: 30 });
    expect(results).toEqual([]);
  });
});
