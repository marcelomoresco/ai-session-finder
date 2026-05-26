import { describe, it, expect } from 'vitest';
import { SettingsService } from './SettingsService';
import { DEFAULT_SETTINGS, type AppSettings } from './Settings';
import type { SettingsStorePort } from './SettingsStore';

class FakeStore implements SettingsStorePort {
  current: AppSettings = { ...DEFAULT_SETTINGS };
  read(): AppSettings {
    return this.current;
  }
  write(settings: AppSettings): void {
    this.current = settings;
  }
}

describe('SettingsService', () => {
  it('reads the current settings', () => {
    expect(new SettingsService(new FakeStore()).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('merges a partial update, persists it, and returns it', () => {
    const store = new FakeStore();
    const service = new SettingsService(store);

    const next = service.update({ theme: 'dark', autoStartOnLogin: true });

    expect(next.theme).toBe('dark');
    expect(store.current.autoStartOnLogin).toBe(true);
    expect(next.launcherShortcut).toBe(DEFAULT_SETTINGS.launcherShortcut);
  });

  it('exposes the launcher shortcut', () => {
    const store = new FakeStore();
    store.current = { ...DEFAULT_SETTINGS, launcherShortcut: 'Cmd+K' };
    expect(new SettingsService(store).getLauncherShortcut()).toBe('Cmd+K');
  });
});
