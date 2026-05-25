import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CodexCliSource, extractSourceId } from './CodexCliSource';
import type { RawSession } from '../RawSession';

const source = new CodexCliSource();

async function collect(iterable: AsyncIterable<RawSession>): Promise<RawSession[]> {
  const out: RawSession[] = [];
  for await (const session of iterable) {
    out.push(session);
  }
  return out;
}

describe('CodexCliSource.matches', () => {
  it('matches Codex rollout paths', () => {
    expect(
      source.matches('/Users/x/.codex/sessions/2026/05/22/rollout-2026-05-22T14-30-00-abc123.jsonl'),
    ).toBe(true);
  });

  it('does not match Claude paths', () => {
    expect(source.matches('/Users/x/.claude/projects/-foo/abc.jsonl')).toBe(false);
  });

  it('does not match a malformed date in the path', () => {
    expect(source.matches('/Users/x/.codex/sessions/2026/5/22/rollout-x.jsonl')).toBe(false);
  });

  it('watches the Codex sessions directory', () => {
    expect(source.watchPaths().some((p) => p.endsWith('/.codex/sessions'))).toBe(true);
  });
});

describe('extractSourceId', () => {
  it('extracts the trailing id segment', () => {
    expect(
      extractSourceId('/x/.codex/sessions/2026/05/22/rollout-2026-05-22T14-30-00-abc123.jsonl'),
    ).toBe('abc123');
  });

  it('falls back to the basename when no id segment matches', () => {
    expect(extractSourceId('/x/rollout.jsonl')).toBe('rollout');
  });
});

describe('CodexCliSource.parse', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'asf-codex-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('parses a synthetic rollout into one RawSession, skipping a broken line', async () => {
    const lines = [
      JSON.stringify({
        type: 'session_meta',
        timestamp: '2026-05-22T10:00:00.000Z',
        cwd: '/Users/x/proj',
      }),
      '{ broken',
      JSON.stringify({
        type: 'message',
        timestamp: '2026-05-22T10:00:01.000Z',
        role: 'user',
        content: 'hello',
      }),
      JSON.stringify({
        type: 'message',
        timestamp: '2026-05-22T10:00:02.000Z',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'hi' }],
        model: 'gpt-5-codex',
        usage: { input_tokens: 7, output_tokens: 3 },
      }),
    ];
    const file = join(dir, 'rollout-2026-05-22T10-00-00-zzz999.jsonl');
    writeFileSync(file, lines.join('\n') + '\n');

    const sessions = await collect(source.parse(file));
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.tool).toBe('codex-cli');
    expect(sessions[0]?.sourceId).toBe('zzz999');
    expect(sessions[0]?.projectName).toBe('proj');
    expect(sessions[0]?.turns).toHaveLength(2);
    expect(sessions[0]?.model).toBe('gpt-5-codex');
    expect(sessions[0]?.tokenUsage.inputTokens).toBe(7);
  });

  it('yields nothing for an empty file', async () => {
    const file = join(dir, 'rollout-x-id.jsonl');
    writeFileSync(file, '\n\n');
    expect(await collect(source.parse(file))).toEqual([]);
  });
});
