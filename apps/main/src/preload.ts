import { contextBridge, ipcRenderer } from 'electron';
import superjson from 'superjson';

interface TrpcResponseOk {
  readonly ok: true;
  readonly data: string;
}
interface TrpcResponseErr {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string };
}

contextBridge.exposeInMainWorld('asf', {
  electronVersion: process.versions.electron,
});

/**
 * Typed tRPC bridge. The renderer's generated client uses this to invoke
 * procedures; input/output cross the wire via superjson so Date/Map round-trip.
 */
contextBridge.exposeInMainWorld('trpc', {
  invoke: async (path: string, type: 'query' | 'mutation', input: unknown): Promise<unknown> => {
    const response = (await ipcRenderer.invoke('trpc', {
      path,
      type,
      input: superjson.stringify(input),
    })) as TrpcResponseOk | TrpcResponseErr;

    if (!response.ok) {
      throw new Error(`${response.error.code}: ${response.error.message}`);
    }
    return superjson.parse(response.data);
  },
});
