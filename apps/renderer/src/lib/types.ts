import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from '@asf/main/ipc/router';

// Renderer-facing types derived from the router. These use the contract shapes
// (string ids) — branded domain ids never reach the renderer.
export type RouterInputs = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export type SearchResult = RouterOutputs['search']['query'][number];
export type SearchFilters = NonNullable<RouterInputs['search']['query']['filters']>;
export type SessionDetail = NonNullable<RouterOutputs['session']['get']>;
export type SessionSummary = RouterOutputs['session']['list'][number];
export type Turn = SessionDetail['turns'][number];
export type ResumeCommand = NonNullable<RouterOutputs['resume']['buildCommand']>;
export type AppSettings = RouterOutputs['settings']['get'];
