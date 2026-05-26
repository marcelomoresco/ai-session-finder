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
import { createMacWindowLocator } from './services/MacWindowLocator';
import { NodeCommandRunner } from './services/NodeCommandRunner';
import { QueryParser } from './services/QueryParser';
import { SettingsService } from './services/SettingsService';
import { InMemorySettingsStore, type SettingsStorePort } from './services/SettingsStore';
import { PermissionsService, type ShellOpener } from './services/PermissionsService';
import { AutoStartService, type LoginItemController } from './services/AutoStartService';
import { IndexAdminService } from './services/IndexAdminService';
import { UpdateService, type AutoUpdaterLike } from './services/UpdateService';
import type { AppSettings } from './services/Settings';

/** Static metadata about the running app (version, OS). */
export interface AppInfo {
  readonly version: string;
  readonly platform: string;
}

/** The wired application: every service, ready to serve IPC. */
export interface AppContext {
  readonly searchService: SearchService;
  readonly sessionService: SessionService;
  readonly resumeService: ResumeService;
  readonly launchService: LaunchService;
  readonly indexerService: IndexerService;
  readonly settingsService: SettingsService;
  readonly permissionsService: PermissionsService;
  readonly autoStartService: AutoStartService;
  readonly indexAdminService: IndexAdminService;
  readonly updateService: UpdateService;
  readonly appInfo: AppInfo;
  /** Persists a settings change, syncs auto-start, and notifies the host. */
  readonly applySettings: (partial: Partial<AppSettings>) => AppSettings;
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
  /** Settings persistence. Defaults to in-memory; prod passes a file-backed store. */
  readonly settingsStore?: SettingsStorePort;
  /** Electron login-item control. Defaults to a no-op. */
  readonly loginItem?: LoginItemController;
  /** Electron shell. Defaults to a no-op. */
  readonly shellOpener?: ShellOpener;
  /** Called after a settings change so the host can re-register the shortcut. */
  readonly onSettingsChanged?: (settings: AppSettings) => void;
  /** App metadata for the About section. Defaults to version 0.0.0 + current platform. */
  readonly appInfo?: AppInfo;
  /** electron-updater's autoUpdater. Defaults to a no-op (never finds an update) for tests. */
  readonly autoUpdater?: AutoUpdaterLike;
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
  const launchService = new LaunchService(
    repo,
    new NodeCommandRunner(),
    logger,
    process.platform === 'darwin' ? createMacWindowLocator(logger) : undefined,
  );
  const indexerService = new IndexerService(options.createWorker, options.indexerCallbacks ?? {}, logger);

  const settingsService = new SettingsService(options.settingsStore ?? new InMemorySettingsStore());
  const autoStartService = new AutoStartService(
    options.loginItem ?? { setOpenAtLogin: () => {}, getOpenAtLogin: () => false },
  );
  const permissionsService = new PermissionsService(
    options.shellOpener ?? { openExternal: () => Promise.resolve() },
  );
  const indexAdminService = new IndexAdminService({
    countAll: () => repo.countAll(),
    lastIndexedAt: () => repo.lastIndexedAt(),
    clearAll: async () => {
      await repo.clearAll();
      if (vectorRepo) {
        await vectorRepo.clearAll();
      }
    },
  });
  const appInfo: AppInfo = options.appInfo ?? { version: '0.0.0', platform: process.platform };
  const updateService = new UpdateService(
    options.autoUpdater ?? {
      checkForUpdates: () => Promise.resolve(null),
      downloadUpdate: () => Promise.resolve(undefined),
      quitAndInstall: () => {},
    },
    logger,
  );
  const applySettings = (partial: Partial<AppSettings>): AppSettings => {
    const next = settingsService.update(partial);
    autoStartService.sync(next.autoStartOnLogin);
    options.onSettingsChanged?.(next);
    return next;
  };

  return {
    searchService,
    sessionService,
    resumeService,
    launchService,
    indexerService,
    settingsService,
    permissionsService,
    autoStartService,
    indexAdminService,
    updateService,
    appInfo,
    applySettings,
    logger,
    close: async () => {
      await indexerService.stop();
      databaseHandle.close();
    },
  };
}
