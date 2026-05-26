import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PermissionsService, type ShellOpener } from './PermissionsService';

class FakeShell implements ShellOpener {
  opened: string[] = [];
  openExternal(url: string): Promise<void> {
    this.opened.push(url);
    return Promise.resolve();
  }
}

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'asf-perms-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('PermissionsService', () => {
  it('reports access when the probe path is readable', async () => {
    const service = new PermissionsService(new FakeShell(), dir);
    expect(await service.hasFullDiskAccess()).toBe(true);
  });

  it('reports no access when the probe path is unreadable', async () => {
    const service = new PermissionsService(new FakeShell(), join(dir, 'does-not-exist'));
    expect(await service.hasFullDiskAccess()).toBe(false);
  });

  it('opens the Full Disk Access settings pane', async () => {
    const shell = new FakeShell();
    await new PermissionsService(shell, dir).openSystemSettings();
    expect(shell.opened[0]).toContain('Privacy_AllFiles');
  });
});
