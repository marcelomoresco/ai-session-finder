import { describe, it, expect } from 'vitest';
import { ClaudeSessionAccumulator } from './ClaudeSessionAccumulator';
import type { ClaudeJsonlEvent } from './ClaudeJsonlEvent';

function ev(over: Partial<ClaudeJsonlEvent> = {}): ClaudeJsonlEvent {
  return {
    timestamp: '2026-05-22T10:00:00.000Z',
    sessionId: 'sess-abc',
    cwd: '/Users/x/proj',
    ...over,
  };
}

describe('ClaudeSessionAccumulator', () => {
  it('captures sessionId, cwd, projectName, and gitBranch from early events', () => {
    const acc = new ClaudeSessionAccumulator('/p/abc.jsonl', 123);
    acc.consume(ev({ cwd: '/Users/x/myproj', gitBranch: 'main' }));
    const raw = acc.finalize();
    expect(raw.tool).toBe('claude-code');
    expect(raw.sourceId).toBe('sess-abc');
    expect(raw.projectPath).toBe('/Users/x/myproj');
    expect(raw.projectName).toBe('myproj');
    expect(raw.gitBranch).toBe('main');
    expect(raw.filePath).toBe('/p/abc.jsonl');
    expect(raw.fileMtime).toBe(123);
  });

  it('tracks earliest startedAt and latest lastActivityAt', () => {
    const acc = new ClaudeSessionAccumulator('/p/x.jsonl', 1);
    acc.consume(ev({ timestamp: '2026-05-22T10:00:00.000Z' }));
    acc.consume(ev({ timestamp: '2026-05-22T09:00:00.000Z' }));
    acc.consume(ev({ timestamp: '2026-05-22T11:00:00.000Z' }));
    const raw = acc.finalize();
    expect(raw.startedAt.toISOString()).toBe('2026-05-22T09:00:00.000Z');
    expect(raw.lastActivityAt.toISOString()).toBe('2026-05-22T11:00:00.000Z');
  });

  it('builds one turn per message, with string or block text content', () => {
    const acc = new ClaudeSessionAccumulator('/p/x.jsonl', 1);
    acc.consume(ev({ message: { role: 'user', content: 'hello' } }));
    acc.consume(
      ev({ message: { role: 'assistant', content: [{ type: 'text', text: 'hi there' }] } }),
    );
    const raw = acc.finalize();
    expect(raw.turns).toHaveLength(2);
    expect(raw.turns[0]?.role).toBe('user');
    expect(raw.turns[0]?.contentText).toBe('hello');
    expect(raw.turns[1]?.role).toBe('assistant');
    expect(raw.turns[1]?.contentText).toBe('hi there');
    expect(raw.turns[1]?.index).toBe(1);
  });

  it('sums token usage across messages, tolerating missing fields', () => {
    const acc = new ClaudeSessionAccumulator('/p/x.jsonl', 1);
    acc.consume(
      ev({
        message: {
          role: 'assistant',
          content: 'a',
          usage: {
            input_tokens: 10,
            output_tokens: 5,
            cache_read_input_tokens: 2,
            cache_creation_input_tokens: 1,
          },
        },
      }),
    );
    acc.consume(ev({ message: { role: 'assistant', content: 'b', usage: { input_tokens: 20 } } }));
    expect(acc.finalize().tokenUsage).toEqual({
      inputTokens: 30,
      outputTokens: 5,
      cacheReadTokens: 2,
      cacheCreationTokens: 1,
    });
  });

  it('extracts toolCalls and filesTouched from tool_use blocks', () => {
    const acc = new ClaudeSessionAccumulator('/p/x.jsonl', 1);
    acc.consume(
      ev({
        message: {
          role: 'assistant',
          content: [
            { type: 'tool_use', id: 'a', name: 'Edit', input: { file_path: '/Users/x/a.ts' } },
            { type: 'tool_use', id: 'b', name: 'Read', input: { file_path: '/Users/x/b.ts' } },
            {
              type: 'tool_use',
              id: 'c',
              name: 'NotebookEdit',
              input: { notebook_path: '/Users/x/n.ipynb' },
            },
            { type: 'tool_use', id: 'd', name: 'Bash', input: { command: 'ls' } },
          ],
        },
      }),
    );
    const turn = acc.finalize().turns[0];
    expect(turn?.toolCalls.map((t) => t.name)).toEqual(['Edit', 'Read', 'NotebookEdit', 'Bash']);
    expect(turn?.filesTouched).toEqual([
      { path: '/Users/x/a.ts', operation: 'edit' },
      { path: '/Users/x/b.ts', operation: 'read' },
      { path: '/Users/x/n.ipynb', operation: 'edit' },
    ]);
  });

  it('captures the first model seen', () => {
    const acc = new ClaudeSessionAccumulator('/p/x.jsonl', 1);
    acc.consume(ev({ message: { role: 'assistant', content: 'a', model: 'claude-opus-4' } }));
    acc.consume(ev({ message: { role: 'assistant', content: 'b', model: 'other' } }));
    expect(acc.finalize().model).toBe('claude-opus-4');
  });

  it('throws on finalize when no sessionId was seen', () => {
    const acc = new ClaudeSessionAccumulator('/p/x.jsonl', 1);
    acc.consume(ev({ sessionId: undefined, message: { role: 'user', content: 'x' } }));
    expect(() => acc.finalize()).toThrow('No sessionId');
  });
});
