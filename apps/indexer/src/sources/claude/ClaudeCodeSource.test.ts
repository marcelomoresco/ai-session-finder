import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ClaudeCodeSource } from './ClaudeCodeSource';
import type { RawSession } from '../RawSession';

const source = new ClaudeCodeSource();

async function collect(iterable: AsyncIterable<RawSession>): Promise<RawSession[]> {
  const out: RawSession[] = [];
  for await (const session of iterable) {
    out.push(session);
  }
  return out;
}

describe('ClaudeCodeSource.matches', () => {
  it('matches Claude project jsonl paths', () => {
    expect(source.matches('/Users/x/.claude/projects/-foo/abc.jsonl')).toBe(true);
  });

  it('does not match Codex rollout paths', () => {
    expect(source.matches('/Users/x/.codex/sessions/2026/05/22/rollout-x.jsonl')).toBe(false);
  });

  it('does not match non-jsonl files', () => {
    expect(source.matches('/Users/x/.claude/projects/-foo/abc.txt')).toBe(false);
  });

  it('watches the Claude projects directory', () => {
    expect(source.watchPaths().some((p) => p.endsWith('/.claude/projects'))).toBe(true);
  });
});

describe('ClaudeCodeSource.parse', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asf-claude-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses a synthetic jsonl into one RawSession, skipping a broken line', async () => {
    const lines = [
      JSON.stringify({
        type: 'user',
        timestamp: '2026-05-22T10:00:00.000Z',
        sessionId: 'sess-1',
        cwd: '/Users/x/proj',
        gitBranch: 'main',
        message: { role: 'user', content: 'hello' },
      }),
      '{ broken json',
      JSON.stringify({
        type: 'assistant',
        timestamp: '2026-05-22T10:01:00.000Z',
        sessionId: 'sess-1',
        cwd: '/Users/x/proj',
        message: {
          role: 'assistant',
          model: 'claude-opus-4',
          content: [
            { type: 'text', text: 'hi' },
            { type: 'tool_use', id: 't', name: 'Edit', input: { file_path: '/Users/x/proj/a.ts' } },
          ],
          usage: { input_tokens: 5, output_tokens: 3 },
        },
      }),
    ];
    const file = join(dir, 'abc.jsonl');
    writeFileSync(file, lines.join('\n') + '\n');

    const sessions = await collect(source.parse(file));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.sourceId).toBe('sess-1');
    expect(sessions[0]?.projectName).toBe('proj');
    expect(sessions[0]?.gitBranch).toBe('main');
    expect(sessions[0]?.model).toBe('claude-opus-4');
    expect(sessions[0]?.turns).toHaveLength(2);
    expect(sessions[0]?.tokenUsage.inputTokens).toBe(5);
    expect(sessions[0]?.turns[1]?.filesTouched).toEqual([
      { path: '/Users/x/proj/a.ts', operation: 'edit' },
    ]);
  });

  it('yields nothing for a file with no valid events', async () => {
    const file = join(dir, 'empty.jsonl');
    writeFileSync(file, '{ broken\n\n');
    expect(await collect(source.parse(file))).toEqual([]);
  });
});
