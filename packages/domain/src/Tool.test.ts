import { describe, it, expect } from 'vitest';
import { isTool, TOOLS } from './Tool';

describe('isTool', () => {
  it('returns true for every known tool', () => {
    for (const tool of TOOLS) {
      expect(isTool(tool)).toBe(true);
    }
  });

  it('returns false for unknown strings', () => {
    expect(isTool('aider')).toBe(false);
    expect(isTool('')).toBe(false);
  });

  it('returns false for non-string values', () => {
    expect(isTool(null)).toBe(false);
    expect(isTool(undefined)).toBe(false);
    expect(isTool(42)).toBe(false);
    expect(isTool({ tool: 'claude-code' })).toBe(false);
  });
});
