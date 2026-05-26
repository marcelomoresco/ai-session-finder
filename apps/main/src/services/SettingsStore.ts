import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_SETTINGS, type AppSettings } from './Settings';

export interface SettingsStorePort {
  read(): AppSettings;
  write(settings: AppSettings): void;
}

/**
 * Persists settings as plain JSON (no electron-store dependency). Reads merge
 * over defaults so missing/older keys are forward-compatible, and a missing or
 * corrupt file falls back to defaults.
 */
export class SettingsStore implements SettingsStorePort {
  constructor(private readonly filePath: string) {}

  read(): AppSettings {
    try {
      const parsed = JSON.parse(readFileSync(this.filePath, 'utf8')) as Partial<AppSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }

  write(settings: AppSettings): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, JSON.stringify(settings, null, 2), 'utf8');
  }
}

/** In-memory store (no persistence). Default for tests / when no path is given. */
export class InMemorySettingsStore implements SettingsStorePort {
  private settings: AppSettings = DEFAULT_SETTINGS;
  read(): AppSettings {
    return this.settings;
  }
  write(settings: AppSettings): void {
    this.settings = settings;
  }
}
