import { join } from 'node:path';
import { Worker } from 'node:worker_threads';
import { app, globalShortcut, ipcMain, shell } from 'electron';
import type { BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { createDatabase } from './persistence/createDatabase';
import { createProductionLogger } from './observability/Logger';
import { createAppContext, type AppContext } from './AppContext';
import { SettingsStore } from './services/SettingsStore';
import { ShortcutManager } from './shortcuts';
import { TrayController } from './tray';
import { createLauncherWindow } from './window/createLauncherWindow';
import { createTrpcContext } from './ipc/createContext';
import { attachTrpcToElectron } from './ipc/electronAdapter';
import type { WorkerHandle } from './services/IndexerService';
import type { AppSettings } from './services/Settings';
import type { Tool } from '@asf/domain';

let appContext: AppContext | null = null;
let launcherWindow: BrowserWindow | null = null;
let shortcuts: ShortcutManager | null = null;
let tray: TrayController | null = null;
let lastEnabledSourcesKey = '';

function sourcesKey(sources: ReadonlyArray<Tool>): string {
  return [...sources].sort().join(',');
}

/** Re-registers the shortcut and, when the enabled sources changed, restarts the indexer. */
function handleSettingsChanged(next: AppSettings): void {
  shortcuts?.reRegister();
  const key = sourcesKey(next.enabledSources);
  if (key !== lastEnabledSourcesKey) {
    lastEnabledSourcesKey = key;
    void appContext?.indexerService.restart();
  }
}

function getWindow(): BrowserWindow {
  if (!launcherWindow || launcherWindow.isDestroyed()) {
    launcherWindow = createLauncherWindow();
  }
  return launcherWindow;
}

/** Shows the window, focuses it, and routes the renderer (hash router) to `route`. */
function navigate(route: string): void {
  const win = getWindow();
  win.show();
  win.focus();
  void win.webContents.executeJavaScript(`window.location.hash = '#${route}';`).catch(() => {});
}

function showLauncher(): void {
  navigate('/');
}

function showSettings(): void {
  navigate('/settings');
}

function trayIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'tray-iconTemplate.png')
    : join(__dirname, '../../resources/tray-iconTemplate.png');
}

/** Composition root for the running app. */
function bootstrap(): void {
  const userDataDir = app.getPath('userData');
  const logger = createProductionLogger();

  // Populates the native About panel (app.showAboutPanel) with name/version/copyright;
  // macOS uses the bundled .icns icon automatically.
  app.setAboutPanelOptions({
    applicationName: 'AI Session Finder',
    applicationVersion: app.getVersion(),
    copyright: `© ${new Date().getFullYear()} Marcelo Moresco · Apache 2.0`,
  });

  // Manual/opt-in updates only — never download or install silently.
  autoUpdater.autoDownload = false;

  appContext = createAppContext({
    databaseHandle: createDatabase(userDataDir),
    logger,
    settingsStore: new SettingsStore(join(userDataDir, 'settings.json')),
    loginItem: {
      setOpenAtLogin: (settings) => app.setLoginItemSettings(settings),
      getOpenAtLogin: () => app.getLoginItemSettings().openAtLogin,
    },
    shellOpener: { openExternal: (url) => shell.openExternal(url) },
    appInfo: { version: app.getVersion(), platform: process.platform },
    autoUpdater,
    onSettingsChanged: handleSettingsChanged,
    createWorker: (): WorkerHandle =>
      new Worker(join(__dirname, 'worker.js'), {
        workerData: {
          userDataDir,
          enabledSources: appContext?.settingsService.get().enabledSources,
        },
      }),
  });

  lastEnabledSourcesKey = sourcesKey(appContext.settingsService.get().enabledSources);

  attachTrpcToElectron(createTrpcContext(appContext));

  // Renderer asks to dismiss the launcher (Escape on an empty query).
  ipcMain.on('launcher:hide', () => launcherWindow?.hide());

  shortcuts = new ShortcutManager(globalShortcut, getWindow, appContext.settingsService, logger);
  shortcuts.register();

  tray = new TrayController(trayIconPath(), {
    openLauncher: showLauncher,
    openSettings: showSettings,
    reindex: () => appContext?.indexerService.fullReindex(),
    quit: () => app.quit(),
  });
  tray.start();

  // Begin indexing on launch. Claude Code (~/.claude) needs no Full Disk Access;
  // Cursor/Codex join once granted. Without this the index stays empty ("No results").
  appContext.indexerService.start();
}

app
  .whenReady()
  .then(() => {
    // Accessory mode: live in the menu bar, no Dock icon (macOS only).
    if (process.platform === 'darwin') {
      app.dock?.hide();
    }
    bootstrap();
    getWindow();
  })
  .catch((error: unknown) => {
    // eslint-disable-next-line no-console -- last-resort logging for a fatal init failure
    console.error('Failed to initialize the app', error);
  });

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  tray?.destroy();
  void appContext?.close();
});

// Tray-resident: closing the window doesn't quit the app on macOS.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
