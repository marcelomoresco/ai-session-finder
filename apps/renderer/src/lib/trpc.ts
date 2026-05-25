import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@asf/main/ipc/router';

/** Typed React Query bindings for the main-process tRPC router. */
export const trpc = createTRPCReact<AppRouter>();
