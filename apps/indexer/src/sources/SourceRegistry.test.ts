import { describe, it, expect } from 'vitest';
import type { Tool } from '@asf/domain';
import { SourceRegistry, createDefaultRegistry } from './SourceRegistry';
import type { SessionSource } from './SessionSource';
import type { RawSession } from './RawSession';

const CLAUDE = '/Users/x/.claude/projects/-foo/abc.jsonl';
const CODEX = '/Users/x/.codex/sessions/2026/05/22/rollout-2026-05-22T14-30-00-abc123.jsonl';
const CURSOR =
  '/Users/x/Library/Application Support/Cursor/User/workspaceStorage/hash/state.vscdb';

const EMPTY_SESSIONS: AsyncIterable<RawSession> = {
  [Symbol.asyncIterator]: () => ({
    next: () => Promise.resolve({ done: true as const, value: undefined }),
  }),
};

function fakeSource(tool: Tool, owns: string): SessionSource {
  return {
    tool,
    watchPaths: () => [`/watch/${tool}`],
    matches: (filePath) => filePath === owns,
    parse: () => EMPTY_SESSIONS,
  };
}

describe('createDefaultRegistry', () => {
  const registry = createDefaultRegistry();

  it('routes each tool path to the source that owns it', () => {
    expect(registry.findFor(CLAUDE)?.tool).toBe('claude-code');
    expect(registry.findFor(CODEX)?.tool).toBe('codex-cli');
    expect(registry.findFor(CURSOR)?.tool).toBe('cursor');
  });

  it('returns null for an unrelated path', () => {
    expect(registry.findFor('/tmp/notes.txt')).toBeNull();
  });

  it('never cross-matches: each tool path is claimed by exactly one source', () => {
    for (const filePath of [CLAUDE, CODEX, CURSOR]) {
      expect(registry.all().filter((s) => s.matches(filePath))).toHaveLength(1);
    }
  });

  it('aggregates the watch paths of every source', () => {
    const paths = registry.allWatchPaths();
    expect(paths).toHaveLength(3);
    expect(paths.some((p) => p.endsWith('/.claude/projects'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/.codex/sessions'))).toBe(true);
    expect(paths.some((p) => p.endsWith('/Cursor/User/workspaceStorage'))).toBe(true);
  });

  it('registers exactly the three default sources', () => {
    expect(
      registry
        .all()
        .map((s) => s.tool)
        .sort(),
    ).toEqual(['claude-code', 'codex-cli', 'cursor']);
  });
});

describe('SourceRegistry', () => {
  it('findFor returns the registered instance whose matches() is true', () => {
    const a = fakeSource('claude-code', '/a');
    const b = fakeSource('cursor', '/b');
    const registry = new SourceRegistry([a, b]);

    expect(registry.findFor('/b')).toBe(b);
    expect(registry.findFor('/a')).toBe(a);
    expect(registry.findFor('/missing')).toBeNull();
    expect(registry.allWatchPaths()).toEqual(['/watch/claude-code', '/watch/cursor']);
  });

  it('watchPathsFor returns only the requested tools, none for an empty set', () => {
    const registry = new SourceRegistry([
      fakeSource('claude-code', '/a'),
      fakeSource('codex-cli', '/b'),
      fakeSource('cursor', '/c'),
    ]);
    expect(registry.watchPathsFor(['claude-code', 'cursor'])).toEqual([
      '/watch/claude-code',
      '/watch/cursor',
    ]);
    expect(registry.watchPathsFor([])).toEqual([]);
  });
});
