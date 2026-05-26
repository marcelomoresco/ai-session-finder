import { SilentLogger, type Logger } from '../observability/Logger';
import type { MainToWorker, WorkerToMain } from './WorkerProtocol';

/**
 * Minimal worker abstraction. The real `node:worker_threads` Worker satisfies it
 * structurally; injecting a factory keeps IndexerService testable without
 * spawning a thread.
 */
export interface WorkerHandle {
  postMessage(message: MainToWorker): void;
  on(event: 'message' | 'error' | 'exit', listener: (arg: unknown) => void): void;
  terminate(): Promise<number>;
}

export type WorkerFactory = () => WorkerHandle;

export interface IndexerCallbacks {
  readonly onReady?: () => void;
  readonly onSessionIndexed?: (sessionId: string) => void;
  readonly onProgress?: (done: number, total: number) => void;
  readonly onError?: (message: string) => void;
}

/**
 * Drives the indexing worker thread from the Electron main process: spawns it,
 * relays typed messages to callbacks, and shuts it down. The worker is isolated
 * — a crash surfaces as an 'error'/'exit' event handled here and never takes
 * down the main process.
 */
export class IndexerService {
  private worker: WorkerHandle | null = null;

  constructor(
    private readonly createWorker: WorkerFactory,
    private readonly callbacks: IndexerCallbacks = {},
    private readonly logger: Logger = new SilentLogger(),
  ) {}

  start(): void {
    if (this.worker) {
      return;
    }
    const worker = this.createWorker();
    worker.on('message', (arg) => this.handleMessage(arg as WorkerToMain));
    worker.on('error', (arg) => {
      const message = arg instanceof Error ? arg.message : String(arg);
      this.logger.error({ message }, 'indexer worker crashed');
      this.callbacks.onError?.(message);
    });
    worker.on('exit', (arg) => {
      this.logger.warn({ code: arg }, 'indexer worker exited');
      this.worker = null;
    });
    worker.postMessage({ type: 'start' } satisfies MainToWorker);
    this.worker = worker;
  }

  fullReindex(): void {
    this.worker?.postMessage({ type: 'fullReindex' } satisfies MainToWorker);
  }

  async stop(): Promise<void> {
    const worker = this.worker;
    if (!worker) {
      return;
    }
    this.worker = null;
    worker.postMessage({ type: 'stop' } satisfies MainToWorker);
    await worker.terminate();
  }

  /** Respawns a running worker (e.g. after enabled-sources change); no-op when stopped. */
  async restart(): Promise<void> {
    if (!this.worker) {
      return;
    }
    await this.stop();
    this.start();
  }

  private handleMessage(message: WorkerToMain): void {
    switch (message.type) {
      case 'ready':
        this.callbacks.onReady?.();
        break;
      case 'sessionIndexed':
        this.callbacks.onSessionIndexed?.(message.sessionId);
        break;
      case 'progress':
        this.callbacks.onProgress?.(message.done, message.total);
        break;
      case 'error':
        this.logger.error({ message: message.message }, 'indexer reported error');
        this.callbacks.onError?.(message.message);
        break;
    }
  }
}
