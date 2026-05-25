import { parentPort, workerData } from 'node:worker_threads';
import {
  ConsoleLogger,
  FsWatcher,
  LocalEmbedder,
  NoopEmbedder,
  Pipeline,
  TurnChunker,
  createDefaultRegistry,
  type Embedder,
  type Logger,
  type SourceRegistry,
} from '@asf/indexer';
import { createDatabase } from '../persistence/createDatabase';
import { SQLiteRepository } from '../persistence/SQLiteRepository';
import { SqliteVecRepository } from '../persistence/VectorRepository';
import type { MainToWorker, WorkerToMain } from './WorkerProtocol';

/** Message channel to the main process. The real worker `parentPort` satisfies it. */
export interface WorkerPort {
  postMessage(message: WorkerToMain): void;
  on(event: 'message', listener: (message: MainToWorker) => void): void;
}

export interface BuildIndexerOptions {
  readonly userDataDir: string;
  readonly logger: Logger;
  /** Defaults to the real Claude/Codex/Cursor sources. */
  readonly registry?: SourceRegistry;
  /** Defaults to LocalEmbedder when semantic search is available, else NoopEmbedder. */
  readonly embedder?: Embedder;
}

export interface Indexer {
  readonly pipeline: Pipeline;
  readonly watcher: FsWatcher;
  readonly semanticSearch: boolean;
  close(): Promise<void>;
}

/**
 * Composition root for the worker. Opens this worker's OWN database connection
 * (NOT shared with the main process — SQLite WAL allows concurrent readers) and
 * wires the full pipeline. `new` lives here because this is where the object
 * graph is assembled; the Pipeline itself stays free of construction.
 */
export function buildIndexer(opts: BuildIndexerOptions): Indexer {
  const handle = createDatabase(opts.userDataDir);
  const repository = new SQLiteRepository(handle.db);
  const vectorRepo = handle.semanticSearch ? new SqliteVecRepository(handle.db) : null;
  const embedder =
    opts.embedder ?? (handle.semanticSearch ? new LocalEmbedder() : new NoopEmbedder());
  const registry = opts.registry ?? createDefaultRegistry();

  const pipeline = new Pipeline({
    registry,
    chunker: new TurnChunker(),
    embedder,
    sessionWriter: repository,
    sessionReader: repository,
    vectorRepo,
    logger: opts.logger,
    clock: () => new Date(),
  });
  const watcher = new FsWatcher(registry.allWatchPaths());

  return {
    pipeline,
    watcher,
    semanticSearch: handle.semanticSearch,
    close: async () => {
      await watcher.stop();
      handle.close();
    },
  };
}

/** Wires an Indexer to a message port. Testable with a fake port. */
export function runWorker(port: WorkerPort, opts: BuildIndexerOptions): Indexer {
  const indexer = buildIndexer(opts);
  const { pipeline, watcher } = indexer;

  watcher.on('ready', () => port.postMessage({ type: 'ready' } satisfies WorkerToMain));
  watcher.on('error', (error) =>
    port.postMessage({ type: 'error', message: error.message } satisfies WorkerToMain),
  );
  watcher.on('fileChanged', (filePath) => {
    void reportIndex(pipeline, port, filePath);
  });

  port.on('message', (message) => {
    switch (message.type) {
      case 'start':
        watcher.start();
        break;
      case 'stop':
        void indexer.close();
        break;
      case 'fullReindex':
        void restart(watcher);
        break;
    }
  });

  return indexer;
}

async function reportIndex(pipeline: Pipeline, port: WorkerPort, filePath: string): Promise<void> {
  try {
    const sessionIds = await pipeline.indexFile(filePath);
    for (const sessionId of sessionIds) {
      port.postMessage({ type: 'sessionIndexed', sessionId } satisfies WorkerToMain);
    }
  } catch (error) {
    port.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error),
    } satisfies WorkerToMain);
  }
}

/** Forces a fresh initial scan: re-emits `add` for every file, re-indexed via the mtime gate. */
async function restart(watcher: FsWatcher): Promise<void> {
  await watcher.stop();
  watcher.start();
}

// --- Worker-thread entry: runs only inside a Worker (parentPort present). ---
if (parentPort) {
  const { userDataDir } = workerData as { userDataDir: string };
  runWorker(parentPort, { userDataDir, logger: new ConsoleLogger() });
}
