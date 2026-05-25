import type { AppContext } from '../AppContext';

/** Per-request tRPC context: just the wired application. */
export interface TrpcContext {
  readonly app: AppContext;
}

export function createTrpcContext(app: AppContext): TrpcContext {
  return { app };
}
