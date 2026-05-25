/**
 * Typed message contract between the Electron main process (IndexerService) and
 * the indexing worker thread (worker.ts). Senders use `satisfies` so every
 * posted message is checked against these unions at compile time.
 */

export type MainToWorker = { type: 'start' } | { type: 'stop' } | { type: 'fullReindex' };

export type WorkerToMain =
  | { type: 'ready' }
  | { type: 'sessionIndexed'; sessionId: string }
  | { type: 'progress'; total: number; done: number }
  | { type: 'error'; message: string };
