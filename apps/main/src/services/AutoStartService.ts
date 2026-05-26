/** Subset of Electron's login-item API (injectable for tests). */
export interface LoginItemController {
  setOpenAtLogin(settings: { openAtLogin: boolean; openAsHidden?: boolean }): void;
  getOpenAtLogin(): boolean;
}

/** Toggles "open at login" (opens hidden so only the tray shows). */
export class AutoStartService {
  constructor(private readonly loginItem: LoginItemController) {}

  enable(): void {
    this.loginItem.setOpenAtLogin({ openAtLogin: true, openAsHidden: true });
  }

  disable(): void {
    this.loginItem.setOpenAtLogin({ openAtLogin: false });
  }

  isEnabled(): boolean {
    return this.loginItem.getOpenAtLogin();
  }

  sync(enabled: boolean): void {
    if (enabled) {
      this.enable();
    } else {
      this.disable();
    }
  }
}
