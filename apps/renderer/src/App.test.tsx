import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { queryClient } from './lib/queryClient';
import { App } from './App';

const SETTINGS = {
  launcherShortcut: 'CommandOrControl+Shift+Space',
  preferredApp: 'terminal',
  theme: 'system',
  semanticSearchEnabled: true,
  autoStartOnLogin: false,
  onboardingCompleted: true,
  enabledSources: ['claude-code', 'codex-cli', 'cursor'],
  encryptDatabase: false,
};

describe('App', () => {
  beforeEach(() => {
    queryClient.clear();
    window.location.hash = '#/';
    Object.defineProperty(window, 'trpc', {
      configurable: true,
      value: {
        invoke: vi.fn((path: string) =>
          path === 'settings.get' ? Promise.resolve(SETTINGS) : Promise.resolve([]),
        ),
      },
    });
  });

  it('renders the launcher at the root route once onboarding is complete', async () => {
    render(<App />);
    expect(await screen.findByPlaceholderText(/search across all/i)).toBeInTheDocument();
  });

  it('launches a clicked session exactly once (no terminal storm)', async () => {
    const calls: string[] = [];
    const browseResults = [
      {
        sessionId: 's1',
        turnId: 't1',
        snippet: 'x',
        projectName: 'proj-x',
        tool: 'claude-code',
        lastActivityAt: new Date(),
        score: 1,
      },
    ];
    Object.defineProperty(window, 'trpc', {
      configurable: true,
      value: {
        invoke: vi.fn((path: string) => {
          calls.push(path);
          if (path === 'settings.get') return Promise.resolve(SETTINGS);
          if (path === 'search.browseActive') return Promise.resolve(browseResults);
          if (path === 'resume.run') return Promise.resolve(true);
          return Promise.resolve([]);
        }),
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByText('proj-x'));

    await waitFor(() => expect(calls.filter((p) => p === 'resume.run')).toHaveLength(1));
    // Give any stray duplicate invocations a chance to land before asserting.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(calls.filter((p) => p === 'resume.run')).toHaveLength(1);
  });
});
