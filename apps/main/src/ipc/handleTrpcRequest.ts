import { TRPCError } from '@trpc/server';
import superjson from 'superjson';
import { appRouter } from './router';
import { createCallerFactory } from './trpc';
import type { TrpcContext } from './createContext';

const createCaller = createCallerFactory(appRouter);

/** Wire request from the renderer. `input` is superjson-encoded. */
export interface TrpcRequest {
  readonly path: string;
  readonly type: 'query' | 'mutation';
  readonly input: string;
}

/** Consistent response envelope. `data` is superjson-encoded. */
export type TrpcResponse =
  | { readonly ok: true; readonly data: string }
  | { readonly ok: false; readonly error: { readonly code: string; readonly message: string } };

type ProcedureFn = (input: unknown) => Promise<unknown>;

/**
 * Executes a tRPC procedure for a transport-agnostic request, applying superjson
 * at the boundary so Date/Map round-trip. Electron-free, so it's unit-testable
 * without a running Electron process.
 */
export async function handleTrpcRequest(
  ctx: TrpcContext,
  request: TrpcRequest,
): Promise<TrpcResponse> {
  try {
    const input = superjson.parse(request.input);
    const procedure = resolveProcedure(createCaller(ctx), request.path);
    const result = await procedure(input);
    return { ok: true, data: superjson.stringify(result) };
  } catch (error) {
    return { ok: false, error: toErrorShape(error) };
  }
}

/**
 * Walks the dotted path on the caller (e.g. `search.query`) to the procedure.
 * Uses direct property access (not the `in` operator) because the tRPC caller
 * is a Proxy whose `has` trap doesn't expose procedure names.
 */
function resolveProcedure(caller: unknown, path: string): ProcedureFn {
  let node: unknown = caller;
  for (const segment of path.split('.')) {
    if (node === null || (typeof node !== 'object' && typeof node !== 'function')) {
      node = undefined;
      break;
    }
    node = (node as Record<string, unknown>)[segment];
  }

  if (typeof node !== 'function') {
    throw new TRPCError({ code: 'NOT_FOUND', message: `No procedure at path "${path}"` });
  }
  return node as ProcedureFn;
}

function toErrorShape(error: unknown): { code: string; message: string } {
  if (error instanceof TRPCError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : String(error),
  };
}
