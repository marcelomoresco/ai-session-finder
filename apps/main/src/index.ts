import { join } from 'node:path';
import { app, BrowserWindow } from 'electron';

// In dev, electron-vite exposes the renderer dev-server URL here.
const rendererDevUrl = process.env['ELECTRON_RENDERER_URL'];

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
