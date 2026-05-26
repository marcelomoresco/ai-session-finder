import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SettingsStore } from './SettingsStore';
import { DEFAULT_SETTINGS } from './Settings';

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'asf-settings-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('SettingsStore', () => {
  it('returns defaults when no file exists', () => {
    expect(new SettingsStore(join(dir, 'settings.json')).read()).toEqual(DEFAULT_SETTINGS);
  });

  it('creates the directory, writes, and reads back', () => {
    const store = new SettingsStore(join(dir, 'nested/settings.json'));
    const next = { ...DEFAULT_SETTINGS, theme: 'dark' as const, autoStartOnLogin: true };
    store.write(next);
    expect(store.read()).toEqual(next);
  });

  it('merges a partial file over defaults (forward-compatible)', () => {
    const file = join(dir, 'settings.json');
    writeFileSync(file, JSON.stringify({ theme: 'light' }));
    expect(new SettingsStore(file).read()).toEqual({ ...DEFAULT_SETTINGS, theme: 'light' });
  });

  it('falls back to defaults on corrupt JSON', () => {
    const file = join(dir, 'settings.json');
    writeFileSync(file, '{ not valid json');
    expect(new SettingsStore(file).read()).toEqual(DEFAULT_SETTINGS);
  });

  it('backfills new defaults (enabledSources, encryptDatabase) for an older file', () => {
    const file = join(dir, 'settings.json');
    writeFileSync(file, JSON.stringify({ theme: 'light' }));
    const settings = new SettingsStore(file).read();
    expect(settings.enabledSources).toEqual(['claude-code', 'codex-cli', 'cursor']);
    expect(settings.encryptDatabase).toBe(false);
  });
});
