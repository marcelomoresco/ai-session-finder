import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from '../providers/AppProviders';
import { useSearch } from './useSearch';

function wrapper({ children }: { children: ReactNode }) {
  return <AppProviders>{children}</AppProviders>;
}

function setInvoke(invoke: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'trpc', { configurable: true, value: { invoke } });
}

const oneResult = [
  {
    sessionId: 's1',
    turnId: 't1',
    snippet: 'hello world',
    projectName: 'p',
    tool: 'cursor',
    lastActivityAt: new Date(),
    score: 1,
  },
];

describe('useSearch', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('does not search for an empty query', async () => {
    const invoke = vi.fn().mockResolvedValue([]);
    setInvoke(invoke);

    renderHook(() => useSearch({ query: '' }), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(invoke).not.toHaveBeenCalled();
  });

  it('runs a quick keyword search after the debounce and returns results', async () => {
    const invoke = vi.fn().mockResolvedValue(oneResult);
    setInvoke(invoke);

    const { result } = renderHook(() => useSearch({ query: 'hello' }), { wrapper });

    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith(
        'search.query',
        'query',
        expect.objectContaining({ text: 'hello', mode: 'quick' }),
      ),
    );
    await waitFor(() => expect(result.current.results).toHaveLength(1));
  });
});
