import { LocalEmbedder, NoopEmbedder, type Embedder } from '@asf/indexer';
import type { DatabaseHandle } from './persistence/createDatabase';
import { SQLiteRepository } from './persistence/SQLiteRepository';
import { SqliteVecRepository } from './persistence/VectorRepository';
import { createProductionLogger, type Logger } from './observability/Logger';
import { SearchService } from './services/SearchService';
import { SessionService } from './services/SessionService';
import { ResumeService } from './services/ResumeService';
import { IndexerService, type IndexerCallbacks, type WorkerFactory } from './services/IndexerService';
import { LaunchService } from './services/LaunchService';
import { NodeCommandRunner } from './services/NodeCommandRunner';
import { QueryParser } from './services/QueryParser';

/** The wired application: every service, ready to serve IPC. */
export interface AppContext {
  readonly searchService: SearchService;
  readonly sessionService: SessionService;
  readonly resumeService: ResumeService;
  readonly launchService: LaunchService;
  readonly indexerService: IndexerService;
  readonly logger: Logger;
  close(): Promise<void>;
}

export interface AppContextOptions {
  /** Opened by the caller (prod: `createDatabase(userDataDir)`; tests: in-memory). */
  readonly databaseHandle: DatabaseHandle;
  /** Spawns the indexer worker thread. Injected so tests avoid real threads. */
  readonly createWorker: WorkerFactory;
  /** Defaults to the production (Pino) logger. */
  readonly logger?: Logger;
  readonly indexerCallbacks?: IndexerCallbacks;
}

/**
 * The single composition root: the one place dependencies are instantiated and
 * injected. Services never construct their own collaborators. Degrades
 * gracefully when sqlite-vec is unavailable (no vector repo, no-op embedder).
 */
export function createAppContext(options: AppContextOptions): AppContext {
  const logger = options.logger ?? createProductionLogger();
  const { databaseHandle } = options;

  const repo = new SQLiteRepository(databaseHandle.db);
  const vectorRepo = databaseHandle.semanticSearch
    ? new SqliteVecRepository(databaseHandle.db)
    : null;
  if (!databaseHandle.semanticSearch) {
    logger.warn({}, 'sqlite-vec unavailable; semantic search disabled');
  }
  const embedder: Embedder = databaseHandle.semanticSearch
    ? new LocalEmbedder()
    : new NoopEmbedder();

  const searchService = new SearchService({
    repo,
    vectorRepo,
    embedder,
    logger,
    parser: new QueryParser(),
  });
  const sessionService = new SessionService(repo, repo);
  const resumeService = new ResumeService(repo);
  const launchService = new LaunchService(repo, new NodeCommandRunner(), logger);
  const indexerService = new IndexerService(options.createWorker, options.indexerCallbacks ?? {}, logger);

  return {
    searchService,
    sessionService,
    resumeService,
    launchService,
    indexerService,
    logger,
    close: async () => {
      await indexerService.stop();
      databaseHandle.close();
    },
  };
}
