import type { AppSettings } from './Settings';
import type { SettingsStorePort } from './SettingsStore';

/** Reads and updates persisted settings. */
export class SettingsService {
  constructor(private readonly store: SettingsStorePort) {}

  get(): AppSettings {
    return this.store.read();
  }

  /** Merges a partial update, persists it, and returns the new settings. */
  update(partial: Partial<AppSettings>): AppSettings {
    const next = { ...this.store.read(), ...partial };
    this.store.write(next);
    return next;
  }

  getLauncherShortcut(): string {
    return this.get().launcherShortcut;
  }
}
