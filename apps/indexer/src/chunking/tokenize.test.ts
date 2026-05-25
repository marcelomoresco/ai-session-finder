import { describe, it, expect } from 'vitest';
import { estimateTokens, CHARS_PER_TOKEN } from './tokenize';

describe('estimateTokens', () => {
  it('is 0 for the empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates chars / CHARS_PER_TOKEN, rounding up', () => {
    expect(estimateTokens('a'.repeat(CHARS_PER_TOKEN))).toBe(1);
    expect(estimateTokens('a'.repeat(CHARS_PER_TOKEN + 1))).toBe(2);
    expect(estimateTokens('a'.repeat(CHARS_PER_TOKEN * 3))).toBe(3);
  });

  it('never underestimates a non-empty string (at least 1 token)', () => {
    expect(estimateTokens('x')).toBeGreaterThanOrEqual(1);
  });
});
