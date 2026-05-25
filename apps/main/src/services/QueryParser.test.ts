import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { QueryParser } from './QueryParser';

const parser = new QueryParser();

describe('QueryParser', () => {
  it('extracts tool, project, and date operators, leaving free text', () => {
    const parsed = parser.parse('tool:claude-code project:/foo >2026-05-01 hello world');
    expect(parsed.text).toBe('hello world');
    expect(parsed.tools).toEqual(['claude-code']);
    expect(parsed.projectPath).toBe('/foo');
    expect(parsed.after).toEqual(new Date('2026-05-01'));
    expect(parsed.before).toBeNull();
  });

  it('parses a before operator', () => {
    const parsed = parser.parse('bug <2026-12-31');
    expect(parsed.before).toEqual(new Date('2026-12-31'));
    expect(parsed.text).toBe('bug');
  });

  it('ignores unknown tools and invalid dates', () => {
    const parsed = parser.parse('tool:notreal >notadate keep');
    expect(parsed.tools).toEqual([]);
    expect(parsed.after).toBeNull();
    expect(parsed.text).toBe('keep');
  });

  it('collects multiple tools', () => {
    const parsed = parser.parse('tool:claude-code tool:cursor x');
    expect(parsed.tools).toEqual(['claude-code', 'cursor']);
  });

  it('returns only free text when there are no operators', () => {
    const parsed = parser.parse('just searching for something');
    expect(parsed.text).toBe('just searching for something');
    expect(parsed.tools).toEqual([]);
    expect(parsed.projectPath).toBeNull();
  });

  describe('properties', () => {
    it('extracts operators regardless of token order', () => {
      const operators = ['tool:cursor', 'project:/p', '>2026-01-01', '<2026-06-01'];
      fc.assert(
        fc.property(
          fc.constantFrom('alpha', 'beta', 'gamma'),
          fc.shuffledSubarray(operators, { minLength: operators.length }),
          (word, shuffled) => {
            const parsed = parser.parse([word, ...shuffled].join(' '));
            expect(parsed.tools).toEqual(['cursor']);
            expect(parsed.projectPath).toBe('/p');
            expect(parsed.after).toEqual(new Date('2026-01-01'));
            expect(parsed.before).toEqual(new Date('2026-06-01'));
            expect(parsed.text).toBe(word);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
