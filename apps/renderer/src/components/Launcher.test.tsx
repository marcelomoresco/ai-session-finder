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

  it('browses active Claude sessions on open, before anything is typed', async () => {
    const invoke = vi.fn().mockResolvedValue(results);
    setInvoke(invoke);
    renderLauncher();

    await waitFor(() => expect(screen.getByText('scheduler')).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith(
      'search.browseActive',
      'query',
      expect.objectContaining({ filters: { tools: ['claude-code'] } }),
    );
  });

  it('shows an empty-state when no sessions are active on open', async () => {
    setInvoke(vi.fn().mockResolvedValue([]));
    renderLauncher();

    await waitFor(() =>
      expect(screen.getByText(/no active sessions/i)).toBeInTheDocument(),
    );
  });

  it('opens exactly one session per click, never the whole list', async () => {
    const many: SearchResult[] = Array.from({ length: 5 }, (_, i) => ({
      sessionId: `s${i}`,
      turnId: `t${i}`,
      snippet: `snippet ${i}`,
      projectName: `proj-${i}`,
      tool: 'claude-code',
      lastActivityAt: new Date(),
      score: 1,
    }));
    setInvoke(vi.fn().mockResolvedValue(many));
    const user = userEvent.setup();
    const { onOpen } = renderLauncher();

    await waitFor(() => expect(screen.getByText('proj-2')).toBeInTheDocument());
    await user.click(screen.getByText('proj-2'));

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ turnId: 't2' }));
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

  it('hides the launcher on Escape when the query is already empty', async () => {
    setInvoke(vi.fn().mockResolvedValue([]));
    const hideLauncher = vi.fn();
    Object.defineProperty(window, 'asf', {
      configurable: true,
      value: { electronVersion: '0', hideLauncher },
    });
    const user = userEvent.setup();
    const { input } = renderLauncher();

    await user.click(input);
    await user.keyboard('{Escape}');

    expect(hideLauncher).toHaveBeenCalledTimes(1);
  });
});
