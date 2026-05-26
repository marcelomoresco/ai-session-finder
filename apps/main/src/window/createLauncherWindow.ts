import { join } from 'node:path';
import { BrowserWindow } from 'electron';

const rendererDevUrl = process.env['ELECTRON_RENDERER_URL'];

/**
 * Frameless, fully transparent, always-on-top launcher that hides on blur and
 * floats over fullscreen apps. The window itself is clear (no vibrancy material)
 * so only the frosted command box shows — its CSS backdrop-blur frosts whatever
 * is behind it. `sandbox: false` because the preload uses superjson.
 */
export function createLauncherWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 720,
    height: 600,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    resizable: false,
    movable: true,
    show: false,
    fullscreenable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.on('blur', () => {
    if (!win.webContents.isDevToolsOpened()) {
      win.hide();
    }
  });

  if (rendererDevUrl !== undefined) {
    void win.loadURL(rendererDevUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
