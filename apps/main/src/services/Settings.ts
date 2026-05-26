import { TOOLS, type Tool } from '@asf/domain';

/**
 * Where a session that isn't already running opens. Terminals run the resume
 * command (`claude --resume` / `codex resume`); editors open the project folder.
 */
export type PreferredApp = 'terminal' | 'iterm' | 'vscode' | 'intellij' | 'cursor';

export interface AppSettings {
  readonly launcherShortcut: string;
  /** Which app a resumed session opens in. */
  readonly preferredApp: PreferredApp;
  readonly theme: 'system' | 'light' | 'dark';
  readonly semanticSearchEnabled: boolean;
  readonly autoStartOnLogin: boolean;
  readonly onboardingCompleted: boolean;
  /** Tools whose sessions are indexed/watched. Toggling one stops its watcher. */
  readonly enabledSources: readonly Tool[];
  /** Opt-in DB encryption (wired in a later sprint; persisted here today). */
  readonly encryptDatabase: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  launcherShortcut: 'CommandOrControl+E',
  preferredApp: 'terminal',
  theme: 'system',
  semanticSearchEnabled: true,
  autoStartOnLogin: false,
  onboardingCompleted: false,
  enabledSources: [...TOOLS],
  encryptDatabase: false,
};
