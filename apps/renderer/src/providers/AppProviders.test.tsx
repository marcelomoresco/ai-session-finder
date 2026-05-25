import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { trpc } from '../lib/trpc';
import { queryClient } from '../lib/queryClient';
import { AppProviders } from './AppProviders';

function Probe() {
  const query = trpc.search.query.useQuery({ text: 'hi', mode: 'quick', filters: {}, limit: 10 });
  if (query.isLoading) return <div>loading</div>;
  if (query.error) return <div>error: {query.error.message}</div>;
  return <div>count: {query.data?.length ?? 0}</div>;
}

function setInvoke(invoke: ReturnType<typeof vi.fn>): void {
  Object.defineProperty(window, 'trpc', { configurable: true, value: { invoke } });
}

describe('AppProviders + tRPC client', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('runs a query through window.trpc.invoke and returns typed data', async () => {
    const invoke = vi.fn().mockResolvedValue([
      {
        sessionId: 's1',
        turnId: 't1',
        snippet: 'hello',
        projectName: 'p',
        tool: 'cursor',
        lastActivityAt: new Date(),
        score: 1,
      },
    ]);
    setInvoke(invoke);

    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    await waitFor(() => expect(screen.getByText('count: 1')).toBeInTheDocument());
    expect(invoke).toHaveBeenCalledWith(
      'search.query',
      'query',
      expect.objectContaining({ text: 'hi' }),
    );
  });

  it('surfaces errors from the bridge', async () => {
    setInvoke(vi.fn().mockRejectedValue(new Error('NOT_FOUND: boom')));

    render(
      <AppProviders>
        <Probe />
      </AppProviders>,
    );

    await waitFor(() => expect(screen.getByText(/error:/)).toBeInTheDocument());
  });
});
