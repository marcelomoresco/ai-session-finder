import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { app, BrowserWindow } from 'electron';
import { createDatabase } from './persistence/createDatabase';
import { createProductionLogger } from './observability/Logger';
import { createAppContext, type AppContext } from './AppContext';
import { createTrpcContext } from './ipc/createContext';
import { attachTrpcToElectron } from './ipc/electronAdapter';
import type { WorkerHandle } from './services/IndexerService';

// In dev, electron-vite exposes the renderer dev-server URL here.
const rendererDevUrl = process.env['ELECTRON_RENDERER_URL'];

let appContext: AppContext | null = null;

/**
 * The composition root for the running app: opens the database, wires services
 * via createAppContext, and exposes the tRPC router over Electron IPC. The
 * indexer worker is spawned lazily (only when the indexer is started).
 */
function startBackend(): void {
  const userDataDir = app.getPath('userData');
  appContext = createAppContext({
    databaseHandle: createDatabase(userDataDir),
    logger: createProductionLogger(),
    createWorker: (): WorkerHandle =>
      new Worker(join(__dirname, 'worker.js'), { workerData: { userDataDir } }),
  });
  attachTrpcToElectron(createTrpcContext(appContext));
}

function createWindow(): void {
  const window = new BrowserWindow({
    width: 700,
    height: 500,
    frame: false,
    transparent: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  window.on('ready-to-show', () => {
    window.show();
  });

  if (rendererDevUrl !== undefined) {
    void window.loadURL(rendererDevUrl);
  } else {
    void window.loadFile(join(__dirname, '../../../renderer/dist/index.html'));
  }
}

app
  .whenReady()
  .then(() => {
    startBackend();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  })
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console -- last-resort logging for a fatal init failure
    console.error('Failed to initialize the app', error);
  });

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  void appContext?.close();
});
