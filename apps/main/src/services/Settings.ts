import { TOOLS, type Tool } from '@asf/domain';

export interface AppSettings {
  readonly launcherShortcut: string;
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
  theme: 'system',
  semanticSearchEnabled: true,
  autoStartOnLogin: false,
  onboardingCompleted: false,
  enabledSources: [...TOOLS],
  encryptDatabase: false,
};
