import type { AppSettings } from '../../lib/types';
import { ShortcutRecorder } from '../../components/ShortcutRecorder';
import { sectionHeadingClass, type SettingsSectionProps } from './types';

const THEMES: ReadonlyArray<AppSettings['theme']> = ['system', 'light', 'dark'];

export function GeneralSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <section className="space-y-4">
      <h2 className={sectionHeadingClass}>General</h2>

      <div className="flex items-center justify-between gap-4">
        <span className="text-sm">Launcher shortcut</span>
        <ShortcutRecorder
          value={settings.launcherShortcut}
          onChange={(launcherShortcut) => onChange({ launcherShortcut })}
        />
      </div>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm">Theme</span>
        <select
          aria-label="Theme"
          value={settings.theme}
          onChange={(event) => onChange({ theme: event.target.value as AppSettings['theme'] })}
          className="rounded-md bg-white/10 px-2 py-1 text-sm"
        >
          {THEMES.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm">Start at login</span>
        <input
          type="checkbox"
          aria-label="Start at login"
          checked={settings.autoStartOnLogin}
          onChange={(event) => onChange({ autoStartOnLogin: event.target.checked })}
        />
      </label>
    </section>
  );
}
