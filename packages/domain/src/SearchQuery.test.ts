import { describe, it, expect } from 'vitest';
import type { SearchQuery, SearchResult } from './SearchQuery';
import { SessionId } from './Session';
import { TurnId } from './Turn';

describe('SearchQuery types', () => {
  it('accepts a well-formed query', () => {
    const query: SearchQuery = {
      text: 'race condition',
      mode: 'quick',
      filters: { tools: ['claude-code', 'codex-cli'] },
      limit: 30,
    };
    expect(query.filters.tools).toHaveLength(2);
  });

  it('accepts a well-formed result', () => {
    const result: SearchResult = {
      sessionId: SessionId.from('s1'),
      turnId: TurnId.from('t1'),
      snippet: 'a snippet',
      projectName: null,
      tool: 'cursor',
      lastActivityAt: new Date(0),
      score: 1.5,
    };
    expect(result.score).toBe(1.5);
  });
});
