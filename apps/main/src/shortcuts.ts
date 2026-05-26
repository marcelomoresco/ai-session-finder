import type { SettingsService } from './services/SettingsService';
import type { Logger } from './observability/Logger';

/** Subset of Electron's globalShortcut we depend on (injectable for tests). */
export interface GlobalShortcutLike {
  register(accelerator: string, callback: () => void): boolean;
  unregisterAll(): void;
}

/** Subset of BrowserWindow the launcher toggle needs. */
export interface LauncherWindowLike {
  isVisible(): boolean;
  isFocused(): boolean;
  show(): void;
  hide(): void;
  focus(): void;
}

/** Registers the global launcher shortcut and toggles the launcher window. */
export class ShortcutManager {
  constructor(
    private readonly shortcut: GlobalShortcutLike,
    private readonly getWindow: () => LauncherWindowLike | null,
    private readonly settings: SettingsService,
    private readonly logger: Logger,
  ) {}

  register(): boolean {
    const accelerator = this.settings.getLauncherShortcut();
    const ok = this.shortcut.register(accelerator, () => this.toggle());
    if (!ok) {
      this.logger.warn({ accelerator }, 'global shortcut registration failed');
    }
    return ok;
  }

  /** Re-register after the shortcut setting changes. */
  reRegister(): boolean {
    this.shortcut.unregisterAll();
    return this.register();
  }

  unregister(): void {
    this.shortcut.unregisterAll();
  }

  private toggle(): void {
    const win = this.getWindow();
    if (!win) {
      return;
    }
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  }
}
