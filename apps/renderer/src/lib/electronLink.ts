import { TRPCClientError, type TRPCLink } from '@trpc/client';
import { observable } from '@trpc/server/observable';
import type { AppRouter } from '@asf/main/ipc/router';
import { trpc } from './trpc';

/**
 * Terminating tRPC link that forwards operations to the preload bridge
 * (`window.trpc.invoke`) over Electron IPC. superjson (de)serialization happens
 * in the preload, so the client uses no transformer here.
 */
export function electronLink(): TRPCLink<AppRouter> {
  return () =>
    ({ op }) =>
      observable((observer) => {
        const { path, type, input } = op;
        if (type === 'subscription') {
          observer.error(
            new TRPCClientError('Subscriptions are not supported over Electron IPC'),
          );
          return;
        }
        window.trpc.invoke(path, type, input).then(
          (data) => {
            observer.next({ result: { type: 'data', data } });
            observer.complete();
          },
          (cause: unknown) => {
            observer.error(
              TRPCClientError.from(cause instanceof Error ? cause : new Error(String(cause))),
            );
          },
        );
      });
}

export function createTrpcClient() {
  return trpc.createClient({ links: [electronLink()] });
}
