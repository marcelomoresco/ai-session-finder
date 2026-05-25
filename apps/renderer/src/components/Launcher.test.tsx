import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SearchResult } from '../lib/types';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from '../providers/AppProviders';
import { Launcher } from './Launcher';

function setInvoke(invoke: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'trpc', { configurable: true, value: { invoke } });
}

const results: SearchResult[] = [
  {
    sessionId: 's1',
    turnId: 't1',
    snippet: 'fix the race condition',
    projectName: 'scheduler',
    tool: 'claude-code',
    lastActivityAt: new Date(),
    score: 1,
  },
];

function renderLauncher(onOpen = vi.fn()) {
  render(
    <AppProviders>
      <Launcher onOpen={onOpen} />
    </AppProviders>,
  );
  return { onOpen, input: screen.getByPlaceholderText<HTMLInputElement>(/search across all/i) };
}

describe('Launcher', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('searches as you type and opens the selected result on Enter', async () => {
    setInvoke(vi.fn().mockResolvedValue(results));
    const user = userEvent.setup();
    const { onOpen, input } = renderLauncher();

    await user.type(input, 'race');
    await waitFor(() =>
      expect(screen.getByText('fix the race condition')).toBeInTheDocument(),
    );

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ turnId: 't1' }));
  });

  it('shows the tool badge for a result', async () => {
    setInvoke(vi.fn().mockResolvedValue(results));
    const user = userEvent.setup();
    const { input } = renderLauncher();

    await user.type(input, 'race');
    await waitFor(() => expect(screen.getByText('fix the race condition')).toBeInTheDocument());
    // "Claude" appears both as a filter chip and the result's tool badge.
    expect(screen.getAllByText('Claude').length).toBeGreaterThanOrEqual(2);
  });

  it('clears the query on Escape', async () => {
    setInvoke(vi.fn().mockResolvedValue([]));
    const user = userEvent.setup();
    const { input } = renderLauncher();

    await user.type(input, 'hello');
    expect(input.value).toBe('hello');

    await user.keyboard('{Escape}');
    expect(input.value).toBe('');
  });
});
