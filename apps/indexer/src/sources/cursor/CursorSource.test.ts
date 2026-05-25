import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createCursorFixture } from '@asf/test-fixtures';
import { CursorSource, parseWorkspaceFolder } from './CursorSource';
import type { RawSession } from '../RawSession';

const source = new CursorSource();

async function collect(iterable: AsyncIterable<RawSession>): Promise<RawSession[]> {
  const out: RawSession[] = [];
  for await (const session of iterable) {
    out.push(session);
  }
  return out;
}

describe('CursorSource.matches', () => {
  it('matches a Cursor state.vscdb under workspaceStorage', () => {
    expect(
      source.matches(
        '/Users/x/Library/Application Support/Cursor/User/workspaceStorage/abc123/state.vscdb',
      ),
    ).toBe(true);
  });

  it('does not match Claude or Codex jsonl paths', () => {
    expect(source.matches('/Users/x/.claude/projects/-foo/abc.jsonl')).toBe(false);
    expect(source.matches('/Users/x/.codex/sessions/2026/05/22/rollout-x.jsonl')).toBe(false);
  });

  it('does not match a stray vscdb outside workspaceStorage', () => {
    expect(source.matches('/Users/x/state.vscdb')).toBe(false);
  });

  it('watches the Cursor workspaceStorage directory', () => {
    expect(source.watchPaths().some((p) => p.endsWith('/Cursor/User/workspaceStorage'))).toBe(true);
  });
});

describe('parseWorkspaceFolder', () => {
  it('extracts a filesystem path from a file:// folder URL', () => {
    const json = JSON.stringify({ folder: pathToFileURL('/Users/x/proj').href });
    expect(parseWorkspaceFolder(json)).toBe('/Users/x/proj');
  });

  it('returns a plain folder path unchanged', () => {
    expect(parseWorkspaceFolder(JSON.stringify({ folder: '/Users/x/proj' }))).toBe('/Users/x/proj');
  });

  it('returns null when folder is missing or json is invalid', () => {
    expect(parseWorkspaceFolder(JSON.stringify({ other: 1 }))).toBeNull();
    expect(parseWorkspaceFolder('not json')).toBeNull();
  });
});

describe('CursorSource.parse', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asf-cursorsrc-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses every composer into a RawSession with projectPath from workspace.json', async () => {
    const file = join(dir, 'state.vscdb');
    createCursorFixture(file, { composerCount: 2, bubblesPerComposer: 2 });
    writeFileSync(
      join(dir, 'workspace.json'),
      JSON.stringify({ folder: pathToFileURL('/Users/x/proj').href }),
    );

    const sessions = await collect(source.parse(file));
    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      expect(session.tool).toBe('cursor');
      expect(session.projectPath).toBe('/Users/x/proj');
      expect(session.projectName).toBe('proj');
      expect(session.turns).toHaveLength(2);
      expect(session.filePath).toBe(file);
    }
    expect(sessions.map((s) => s.sourceId).sort()).toEqual(['comp-0', 'comp-1']);
  });

  it('leaves projectPath null when workspace.json is absent', async () => {
    const file = join(dir, 'state.vscdb');
    createCursorFixture(file, { composerCount: 1, bubblesPerComposer: 1 });

    const [session] = await collect(source.parse(file));
    expect(session?.projectPath).toBeNull();
    expect(session?.projectName).toBeNull();
  });
});
