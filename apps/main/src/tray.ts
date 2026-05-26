import { app, Menu, nativeImage, Tray } from 'electron';

export interface TrayCallbacks {
  readonly openLauncher: () => void;
  readonly openSettings: () => void;
  readonly reindex: () => void;
  readonly quit: () => void;
}

export interface TrayStats {
  readonly indexed: number;
}

/**
 * Menu-bar tray. The icon is a template image (monochrome + alpha) so macOS
 * tints it for light/dark menu bars. Cross-platform; only the icon styling is
 * macOS-flavoured.
 */
export class TrayController {
  private tray: Tray | null = null;

  constructor(
    private readonly iconPath: string,
    private readonly callbacks: TrayCallbacks,
  ) {}

  start(): void {
    const icon = nativeImage.createFromPath(this.iconPath).resize({ width: 18, height: 18 });
    icon.setTemplateImage(true);
    this.tray = new Tray(icon);
    this.tray.setToolTip('AI Session Finder');
    this.refresh();
  }

  refresh(stats?: TrayStats): void {
    if (!this.tray) {
      return;
    }
    const menu = Menu.buildFromTemplate([
      {
        label: 'Open Launcher',
        accelerator: 'CmdOrCtrl+E',
        click: () => this.callbacks.openLauncher(),
      },
      { type: 'separator' },
      { label: stats ? `${stats.indexed} sessions indexed` : 'Indexing…', enabled: false },
      { label: 'Reindex now', click: () => this.callbacks.reindex() },
      { type: 'separator' },
      { label: 'Settings…', click: () => this.callbacks.openSettings() },
      {
        label: 'About AI Session Finder',
        click: () => {
          // Accessory app isn't frontmost; pull it forward so the About panel
          // shows on top of every other window instead of behind them.
          app.focus({ steal: true });
          app.showAboutPanel();
        },
      },
      { type: 'separator' },
      { label: 'Quit', accelerator: 'CmdOrCtrl+Q', click: () => this.callbacks.quit() },
    ]);
    this.tray.setContextMenu(menu);
  }

  destroy(): void {
    this.tray?.destroy();
    this.tray = null;
  }
}
