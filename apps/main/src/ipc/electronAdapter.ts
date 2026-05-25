import { ipcMain } from 'electron';
import { handleTrpcRequest, type TrpcRequest } from './handleTrpcRequest';
import type { TrpcContext } from './createContext';

export const TRPC_IPC_CHANNEL = 'trpc';

/**
 * Bridges the renderer's `ipcRenderer.invoke('trpc', …)` calls to the tRPC
 * router. Thin Electron glue over the testable {@link handleTrpcRequest}.
 */
export function attachTrpcToElectron(ctx: TrpcContext): void {
  ipcMain.handle(TRPC_IPC_CHANNEL, (_event, request: TrpcRequest) =>
    handleTrpcRequest(ctx, request),
  );
}
