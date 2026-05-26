import { access, constants } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Subset of Electron's shell we use (injectable for tests). */
export interface ShellOpener {
  openExternal(url: string): Promise<void>;
}

const CURSOR_STORAGE = 'Library/Application Support/Cursor/User/workspaceStorage';
const FULL_DISK_SETTINGS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles';

/**
 * Checks Full Disk Access by *actually reading* a protected path (Cursor's
 * storage), never trusting an API that can false-positive. The probe path is
 * injectable for tests.
 */
export class PermissionsService {
  constructor(
    private readonly shell: ShellOpener,
    private readonly probePath: string = join(homedir(), CURSOR_STORAGE),
  ) {}

  async hasFullDiskAccess(): Promise<boolean> {
    try {
      await access(this.probePath, constants.R_OK);
      return true;
    } catch {
      return false;
    }
  }

  openSystemSettings(): Promise<void> {
    return this.shell.openExternal(FULL_DISK_SETTINGS_URL);
  }
}
