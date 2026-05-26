import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PreferredApp } from './Settings';

const APP_DIRS = [
  '/Applications',
  join(homedir(), 'Applications'),
  '/System/Applications',
  '/System/Applications/Utilities',
];

function installed(bundles: ReadonlyArray<string>): boolean {
  return bundles.some((name) => APP_DIRS.some((dir) => existsSync(join(dir, name))));
}

/**
 * The apps a session can be opened in that are actually installed. Terminal is
 * always present on macOS; the rest are listed only when their `.app` exists, so
 * the Settings picker never offers an app the user doesn't have.
 */
export function availableApps(): PreferredApp[] {
  const apps: PreferredApp[] = ['terminal'];
  if (installed(['iTerm.app'])) apps.push('iterm');
  if (installed(['Visual Studio Code.app'])) apps.push('vscode');
  if (installed(['IntelliJ IDEA.app', 'IntelliJ IDEA CE.app', 'IntelliJ IDEA Ultimate.app'])) {
    apps.push('intellij');
  }
  if (installed(['Cursor.app'])) apps.push('cursor');
  return apps;
}
