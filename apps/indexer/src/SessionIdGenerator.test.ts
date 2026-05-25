import { describe, it, expect } from 'vitest';
import { SessionIdGenerator } from './SessionIdGenerator';

describe('SessionIdGenerator', () => {
  it('is deterministic for the same tool + sourceId', () => {
    expect(SessionIdGenerator.generate('claude-code', 'abc')).toBe(
      SessionIdGenerator.generate('claude-code', 'abc'),
    );
  });

  it('differs when the tool differs', () => {
    expect(SessionIdGenerator.generate('claude-code', 'abc')).not.toBe(
      SessionIdGenerator.generate('codex-cli', 'abc'),
    );
  });

  it('differs when the sourceId differs', () => {
    expect(SessionIdGenerator.generate('cursor', 'a')).not.toBe(
      SessionIdGenerator.generate('cursor', 'b'),
    );
  });

  it('produces a 32-char hex id', () => {
    const id = SessionIdGenerator.generate('claude-code', 'whatever');
    expect(id).toMatch(/^[0-9a-f]{32}$/);
  });
});
