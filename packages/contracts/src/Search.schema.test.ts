import { describe, it, expect } from 'vitest';
import { BrowseActiveInputSchema, SearchQuerySchema, SearchResultSchema } from './Search.schema';

describe('SearchQuerySchema', () => {
  it('applies defaults for mode, filters, and limit', () => {
    const parsed = SearchQuerySchema.parse({ text: 'hello' });
    expect(parsed.mode).toBe('quick');
    expect(parsed.limit).toBe(30);
    expect(parsed.filters).toEqual({});
  });

  it('accepts a fully specified query', () => {
    const parsed = SearchQuerySchema.parse({
      text: 'race condition',
      mode: 'smart',
      filters: { tools: ['claude-code'], projectPath: '/repo' },
      limit: 10,
    });
    expect(parsed.mode).toBe('smart');
    expect(parsed.filters.tools).toEqual(['claude-code']);
  });

  it('rejects empty text', () => {
    expect(() => SearchQuerySchema.parse({ text: '' })).toThrow();
  });

  it('rejects a limit over 100', () => {
    expect(() => SearchQuerySchema.parse({ text: 'x', limit: 101 })).toThrow();
  });

  it('rejects an unknown tool in filters', () => {
    expect(() => SearchQuerySchema.parse({ text: 'x', filters: { tools: ['aider'] } })).toThrow();
  });
});

describe('BrowseActiveInputSchema', () => {
  it('applies defaults for filters and limit', () => {
    const parsed = BrowseActiveInputSchema.parse({});
    expect(parsed.limit).toBe(20);
    expect(parsed.filters).toEqual({});
  });

  it('accepts a tools filter and explicit limit', () => {
    const parsed = BrowseActiveInputSchema.parse({ filters: { tools: ['claude-code'] }, limit: 5 });
    expect(parsed.filters.tools).toEqual(['claude-code']);
    expect(parsed.limit).toBe(5);
  });

  it('rejects a limit over 100', () => {
    expect(() => BrowseActiveInputSchema.parse({ limit: 101 })).toThrow();
  });
});

describe('SearchResultSchema', () => {
  it('parses a valid result', () => {
    const result = SearchResultSchema.parse({
      sessionId: 's1',
      turnId: 't1',
      snippet: 'a snippet',
      projectName: null,
      tool: 'cursor',
      lastActivityAt: new Date(0),
      score: 1.2,
    });
    expect(result.tool).toBe('cursor');
  });

  it('rejects a non-Date lastActivityAt', () => {
    expect(() =>
      SearchResultSchema.parse({
        sessionId: 's1',
        turnId: 't1',
        snippet: 'a snippet',
        projectName: null,
        tool: 'cursor',
        lastActivityAt: '2020-01-01',
        score: 1.2,
      }),
    ).toThrow();
  });
});
