import { useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { trpc } from '../lib/trpc';
import { queryClient } from '../lib/queryClient';
import { createTrpcClient } from '../lib/electronLink';

export function AppProviders({ children }: { children: ReactNode }) {
  const [trpcClient] = useState(() => createTrpcClient());
  return (
    <QueryClientProvider client={queryClient}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </trpc.Provider>
    </QueryClientProvider>
  );
}
