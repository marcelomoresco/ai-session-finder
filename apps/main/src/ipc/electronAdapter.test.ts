import { describe, it, expect, vi } from 'vitest';
import superjson from 'superjson';

const { handleSpy } = vi.hoisted(() => ({ handleSpy: vi.fn() }));
vi.mock('electron', () => ({ ipcMain: { handle: handleSpy } }));

import { createInMemoryDatabase } from '../persistence/createDatabase';
import { SilentLogger } from '../observability/Logger';
import { createAppContext } from '../AppContext';
import type { WorkerHandle } from '../services/IndexerService';
import type { TrpcResponse } from './handleTrpcRequest';
import { createTrpcContext } from './createContext';
import { attachTrpcToElectron, TRPC_IPC_CHANNEL } from './electronAdapter';

const fakeWorker = (): WorkerHandle => ({
  postMessage(): void {},
  on(): void {},
  terminate(): Promise<number> {
    return Promise.resolve(0);
  },
});

type IpcListener = (event: unknown, request: unknown) => Promise<TrpcResponse>;

describe('attachTrpcToElectron', () => {
  it('registers the trpc channel and routes requests to the tRPC dispatcher', async () => {
    const app = createAppContext({
      databaseHandle: createInMemoryDatabase(),
      createWorker: fakeWorker,
      logger: new SilentLogger(),
    });
    attachTrpcToElectron(createTrpcContext(app));

    expect(handleSpy).toHaveBeenCalledWith(TRPC_IPC_CHANNEL, expect.any(Function));
    const listener = handleSpy.mock.calls[0]?.[1] as IpcListener;

    const res = await listener(
      {},
      {
        path: 'search.query',
        type: 'query',
        input: superjson.stringify({ text: 'x', mode: 'quick', filters: {}, limit: 5 }),
      },
    );

    expect(res.ok).toBe(true);
    await app.close();
  });
});
