import { describe, it, expect } from 'vitest';
import { parseContent } from './markdown';

describe('parseContent', () => {
  it('returns a single text segment for plain prose', () => {
    expect(parseContent('hello world')).toEqual([{ type: 'text', value: 'hello world' }]);
  });

  it('returns an empty list for empty input', () => {
    expect(parseContent('')).toEqual([]);
  });

  it('splits prose around a fenced code block', () => {
    expect(parseContent('before\n```ts\nconst x = 1;\n```\nafter')).toEqual([
      { type: 'text', value: 'before\n' },
      { type: 'code', value: 'const x = 1;\n', lang: 'ts' },
      { type: 'text', value: '\nafter' },
    ]);
  });

  it('defaults an unlabeled fence to "text"', () => {
    expect(parseContent('```\nplain\n```')).toEqual([
      { type: 'code', value: 'plain\n', lang: 'text' },
    ]);
  });
});
