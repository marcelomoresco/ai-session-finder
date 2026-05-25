import { ConsoleLogger, type Logger } from '@asf/indexer';
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
    private readonly logger: Logger = new ConsoleLogger(),
  ) {}

  start(): void {
    if (this.worker) {
      return;
    }
    const worker = this.createWorker();
    worker.on('message', (arg) => this.handleMessage(arg as WorkerToMain));
    worker.on('error', (arg) => {
      const message = arg instanceof Error ? arg.message : String(arg);
      this.logger.error('indexer worker crashed', { message });
      this.callbacks.onError?.(message);
    });
    worker.on('exit', (arg) => {
      this.logger.warn('indexer worker exited', { code: arg });
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
        this.logger.error('indexer reported error', { message: message.message });
        this.callbacks.onError?.(message.message);
        break;
    }
  }
}
