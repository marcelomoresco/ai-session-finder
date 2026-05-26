import { join } from 'node:path';
import { app, BrowserWindow, shell } from 'electron';

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
    center: true,
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

  // Accessory app (no Dock icon): every time the launcher shows, pull the app to
  // the front stealing focus, so it always receives keyboard input even when
  // another app/window is active.
  win.on('show', () => {
    // Centered on first creation (center: true); afterwards we keep wherever the
    // user dragged it (the launcher is movable, Spotlight-style).
    app.focus({ steal: true });
    win.focus();
  });

  // External links (GitHub, Discussions, …) open in the default browser — never
  // in the launcher window, which would navigate away from the app with no way back.
  const isExternal = (url: string): boolean =>
    (url.startsWith('http://') || url.startsWith('https://')) &&
    !(rendererDevUrl !== undefined && url.startsWith(rendererDevUrl));

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternal(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isExternal(url)) {
      event.preventDefault();
      void shell.openExternal(url);
    }
  });

  if (rendererDevUrl !== undefined) {
    void win.loadURL(rendererDevUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
