import { describe, it, expect } from 'vitest';
import { SilentLogger } from './observability/Logger';
import { SettingsService } from './services/SettingsService';
import { DEFAULT_SETTINGS } from './services/Settings';
import type { SettingsStorePort } from './services/SettingsStore';
import { ShortcutManager, type GlobalShortcutLike, type LauncherWindowLike } from './shortcuts';

function settingsWith(shortcut: string): SettingsService {
  const store: SettingsStorePort = {
    read: () => ({ ...DEFAULT_SETTINGS, launcherShortcut: shortcut }),
    write: () => {},
  };
  return new SettingsService(store);
}

class FakeShortcut implements GlobalShortcutLike {
  registered: string | null = null;
  callback: (() => void) | null = null;
  unregisterAllCount = 0;
  constructor(private readonly succeed = true) {}
  register(accelerator: string, callback: () => void): boolean {
    this.registered = accelerator;
    this.callback = callback;
    return this.succeed;
  }
  unregisterAll(): void {
    this.unregisterAllCount += 1;
  }
}

class FakeWindow implements LauncherWindowLike {
  visible = false;
  focused = false;
  readonly actions: string[] = [];
  isVisible(): boolean {
    return this.visible;
  }
  isFocused(): boolean {
    return this.focused;
  }
  show(): void {
    this.actions.push('show');
    this.visible = true;
  }
  hide(): void {
    this.actions.push('hide');
    this.visible = false;
  }
  focus(): void {
    this.actions.push('focus');
    this.focused = true;
  }
}

describe('ShortcutManager', () => {
  it('registers the configured accelerator', () => {
    const shortcut = new FakeShortcut(true);
    const manager = new ShortcutManager(
      shortcut,
      () => new FakeWindow(),
      settingsWith('Cmd+Shift+Space'),
      new SilentLogger(),
    );
    expect(manager.register()).toBe(true);
    expect(shortcut.registered).toBe('Cmd+Shift+Space');
  });

  it('returns false when registration fails', () => {
    const manager = new ShortcutManager(
      new FakeShortcut(false),
      () => null,
      settingsWith('Cmd+Shift+Space'),
      new SilentLogger(),
    );
    expect(manager.register()).toBe(false);
  });

  it('shows and focuses the launcher when it is hidden', () => {
    const shortcut = new FakeShortcut();
    const win = new FakeWindow();
    new ShortcutManager(shortcut, () => win, settingsWith('X'), new SilentLogger()).register();

    shortcut.callback?.();
    expect(win.actions).toEqual(['show', 'focus']);
  });

  it('hides the launcher when it is visible and focused', () => {
    const shortcut = new FakeShortcut();
    const win = new FakeWindow();
    win.visible = true;
    win.focused = true;
    new ShortcutManager(shortcut, () => win, settingsWith('X'), new SilentLogger()).register();

    shortcut.callback?.();
    expect(win.actions).toEqual(['hide']);
  });

  it('re-registers by clearing then registering again', () => {
    const shortcut = new FakeShortcut();
    const manager = new ShortcutManager(shortcut, () => null, settingsWith('X'), new SilentLogger());

    manager.reRegister();
    expect(shortcut.unregisterAllCount).toBe(1);
    expect(shortcut.registered).toBe('X');
  });
});
