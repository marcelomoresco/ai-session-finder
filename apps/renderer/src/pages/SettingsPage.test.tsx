import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from '../providers/AppProviders';
import { SettingsPage } from './SettingsPage';

const SETTINGS = {
  launcherShortcut: 'CommandOrControl+Shift+Space',
  theme: 'system',
  semanticSearchEnabled: true,
  autoStartOnLogin: false,
  onboardingCompleted: true,
  enabledSources: ['claude-code', 'codex-cli', 'cursor'],
  encryptDatabase: false,
};

interface Calls {
  readonly updates: unknown[];
  readonly invoked: string[];
}

function setup(): Calls {
  const calls: Calls = { updates: [], invoked: [] };
  Object.defineProperty(window, 'trpc', {
    configurable: true,
    value: {
      invoke: vi.fn((path: string, _type: string, input: unknown) => {
        calls.invoked.push(path);
        switch (path) {
          case 'settings.get':
            return Promise.resolve(SETTINGS);
          case 'settings.update':
            calls.updates.push(input);
            return Promise.resolve({ ...SETTINGS, ...(input as Record<string, unknown>) });
          case 'indexer.stats':
            return Promise.resolve({ indexed: 12, lastSync: null });
          case 'system.info':
            return Promise.resolve({ version: '1.2.3', platform: 'darwin' });
          default:
            return Promise.resolve(undefined);
        }
      }),
    },
  });
  return calls;
}

function renderPage(): void {
  render(
    <AppProviders>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </AppProviders>,
  );
}

describe('SettingsPage', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('renders all four sections', async () => {
    setup();
    renderPage();

    await screen.findByText('Settings');
    expect(screen.getByText('General')).toBeInTheDocument();
    expect(screen.getByText('Sources')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
    expect(screen.getByText('About')).toBeInTheDocument();
  });

  it('toggling a source off persists the reduced enabledSources', async () => {
    const calls = setup();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Settings');
    await user.click(screen.getByLabelText('Cursor'));

    await waitFor(() =>
      expect(calls.updates).toContainEqual({ enabledSources: ['claude-code', 'codex-cli'] }),
    );
  });

  it('clearing the index asks for confirmation then calls clearIndex', async () => {
    const calls = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Settings');
    await user.click(screen.getByText('Clear search index'));

    expect(confirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(calls.invoked).toContain('indexer.clearIndex'));
    confirm.mockRestore();
  });

  it('does not clear the index when confirmation is declined', async () => {
    const calls = setup();
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Settings');
    await user.click(screen.getByText('Clear search index'));

    expect(calls.invoked).not.toContain('indexer.clearIndex');
    confirm.mockRestore();
  });

  it('reset onboarding flips the flag back to false', async () => {
    const calls = setup();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Settings');
    await user.click(screen.getByText('Reset onboarding'));

    await waitFor(() => expect(calls.updates).toContainEqual({ onboardingCompleted: false }));
  });

  it('reindex all drives the indexer', async () => {
    const calls = setup();
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Settings');
    await user.click(screen.getByText('Reindex all'));

    await waitFor(() => expect(calls.invoked).toContain('indexer.fullReindex'));
  });
});
