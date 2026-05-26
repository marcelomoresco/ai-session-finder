import type { Logger } from '../observability/Logger';

export interface UpdateInfo {
  readonly version: string;
}

/** Subset of electron-updater's `autoUpdater` we depend on (injectable for tests). */
export interface AutoUpdaterLike {
  checkForUpdates(): Promise<{ updateInfo: UpdateInfo } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(): void;
}

/**
 * Wraps electron-updater. Never downloads silently — `checkForUpdates` only
 * reports, and `downloadAndInstall` is called explicitly after the user agrees.
 * A failed check (e.g. update server offline) degrades to `null`, never throws.
 */
export class UpdateService {
  constructor(
    private readonly updater: AutoUpdaterLike,
    private readonly logger: Logger,
  ) {}

  async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      const result = await this.updater.checkForUpdates();
      return result?.updateInfo ?? null;
    } catch (error) {
      this.logger.warn({ err: String(error) }, 'update check failed');
      return null;
    }
  }

  async downloadAndInstall(): Promise<void> {
    await this.updater.downloadUpdate();
    this.updater.quitAndInstall();
  }
}
