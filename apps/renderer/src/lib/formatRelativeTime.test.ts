import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './formatRelativeTime';

const now = new Date('2026-05-25T12:00:00.000Z');

describe('formatRelativeTime', () => {
  it('shows "just now" under 45 seconds', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 10_000), now)).toBe('just now');
  });

  it('shows minutes, hours, and days', () => {
    expect(formatRelativeTime(new Date(now.getTime() - 5 * 60_000), now)).toBe('5m ago');
    expect(formatRelativeTime(new Date(now.getTime() - 3 * 3_600_000), now)).toBe('3h ago');
    expect(formatRelativeTime(new Date(now.getTime() - 2 * 86_400_000), now)).toBe('2d ago');
  });

  it('falls back to an absolute date beyond a week', () => {
    const out = formatRelativeTime(new Date('2026-01-05T12:00:00.000Z'), now);
    expect(out).not.toMatch(/ago|just now/);
    expect(out.length).toBeGreaterThan(0);
  });
});
