import { describe, it, expect } from 'vitest';
import { CodexSessionAccumulator } from './CodexSessionAccumulator';

describe('CodexSessionAccumulator', () => {
  it('uses the injected sourceId and tool codex-cli', () => {
    const acc = new CodexSessionAccumulator('/p/rollout-x.jsonl', 9, 'abc123');
    acc.consume({ timestamp: '2026-05-22T10:00:00.000Z', cwd: '/Users/x/proj' });
    const raw = acc.finalize();
    expect(raw.tool).toBe('codex-cli');
    expect(raw.sourceId).toBe('abc123');
    expect(raw.projectPath).toBe('/Users/x/proj');
    expect(raw.projectName).toBe('proj');
    expect(raw.filePath).toBe('/p/rollout-x.jsonl');
    expect(raw.fileMtime).toBe(9);
  });

  it('tracks earliest/latest timestamps and sums usage', () => {
    const acc = new CodexSessionAccumulator('/p/x.jsonl', 1, 'id');
    acc.consume({
      timestamp: '2026-05-22T10:00:00.000Z',
      usage: { input_tokens: 10, output_tokens: 4, cached_input_tokens: 2 },
    });
    acc.consume({ timestamp: '2026-05-22T09:00:00.000Z', usage: { input_tokens: 5 } });
    const raw = acc.finalize();
    expect(raw.startedAt.toISOString()).toBe('2026-05-22T09:00:00.000Z');
    expect(raw.tokenUsage).toEqual({
      inputTokens: 15,
      outputTokens: 4,
      cacheReadTokens: 2,
      cacheCreationTokens: 0,
    });
  });

  it('builds turns from role + content (string or blocks)', () => {
    const acc = new CodexSessionAccumulator('/p/x.jsonl', 1, 'id');
    acc.consume({ timestamp: '2026-05-22T10:00:00.000Z', role: 'user', content: 'do the thing' });
    acc.consume({
      timestamp: '2026-05-22T10:01:00.000Z',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'done' }],
    });
    const raw = acc.finalize();
    expect(raw.turns).toHaveLength(2);
    expect(raw.turns[0]?.role).toBe('user');
    expect(raw.turns[0]?.contentText).toBe('do the thing');
    expect(raw.turns[1]?.role).toBe('assistant');
    expect(raw.turns[1]?.contentText).toBe('done');
  });

  it('ignores non-message events for turns', () => {
    const acc = new CodexSessionAccumulator('/p/x.jsonl', 1, 'id');
    acc.consume({ type: 'session_meta', timestamp: '2026-05-22T10:00:00.000Z', cwd: '/x' });
    expect(acc.finalize().turns).toHaveLength(0);
  });

  it('captures the first model seen', () => {
    const acc = new CodexSessionAccumulator('/p/x.jsonl', 1, 'id');
    acc.consume({
      timestamp: '2026-05-22T10:00:00.000Z',
      role: 'assistant',
      content: 'hi',
      model: 'gpt-5-codex',
    });
    expect(acc.finalize().model).toBe('gpt-5-codex');
  });
});
