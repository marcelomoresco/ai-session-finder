import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type * as MarkdownModule from '../lib/markdown';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from '../providers/AppProviders';
import { PreviewPane } from './PreviewPane';

// Avoid loading the real Shiki highlighter in jsdom.
vi.mock('../lib/markdown', async (importOriginal) => {
  const actual = await importOriginal<typeof MarkdownModule>();
  return { ...actual, highlightCode: vi.fn().mockResolvedValue('<pre>code</pre>') };
});

const session = {
  id: 's1',
  tool: 'claude-code',
  sourceId: 'src',
  projectPath: '/repo',
  projectName: 'scheduler',
  gitBranch: 'main',
  startedAt: new Date(),
  lastActivityAt: new Date(),
  turnCount: 2,
  model: 'opus',
  tokenUsage: { inputTokens: 1, outputTokens: 2, cacheReadTokens: 0, cacheCreationTokens: 0 },
  filePath: '/s.jsonl',
  fileMtime: 1,
  indexedAt: new Date(),
};

const turns = [
  {
    id: 't1',
    sessionId: 's1',
    index: 0,
    role: 'user',
    contentText: 'fix the bug',
    toolCalls: [],
    filesTouched: [],
    timestamp: new Date(),
  },
  {
    id: 't2',
    sessionId: 's1',
    index: 1,
    role: 'assistant',
    contentText: 'here:\n```ts\nconst x = 1;\n```',
    toolCalls: [],
    filesTouched: [],
    timestamp: new Date(),
  },
];

function invokeFor(path: string): Promise<unknown> {
  if (path === 'session.get') return Promise.resolve({ session, turns });
  if (path === 'resume.buildCommand') {
    return Promise.resolve({ command: 'claude --resume src', workingDirectory: '/repo', hint: 'h' });
  }
  return Promise.resolve(null);
}

function mountWithData(): void {
  Object.defineProperty(window, 'trpc', {
    configurable: true,
    value: { invoke: vi.fn((path: string) => invokeFor(path)) },
  });
}

describe('PreviewPane', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('renders the session header and its turns', async () => {
    mountWithData();
    render(
      <AppProviders>
        <PreviewPane sessionId="s1" />
      </AppProviders>,
    );

    expect(await screen.findByText('scheduler')).toBeInTheDocument();
    expect(screen.getByText('fix the bug')).toBeInTheDocument();
    expect(screen.getByText(/2 turns/)).toBeInTheDocument();
  });

  it('scrolls the focused turn into view', async () => {
    const scrollSpy = vi.spyOn(Element.prototype, 'scrollIntoView');
    mountWithData();
    render(
      <AppProviders>
        <PreviewPane sessionId="s1" focusedTurnId="t1" />
      </AppProviders>,
    );

    await screen.findByText('scheduler');
    expect(scrollSpy).toHaveBeenCalled();
  });
});
