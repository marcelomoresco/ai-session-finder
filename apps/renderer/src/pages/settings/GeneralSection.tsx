import type { AppSettings } from '../../lib/types';
import { ShortcutRecorder } from '../../components/ShortcutRecorder';
import { Toggle } from '../../components/Toggle';
import { cardClass, rowClass, sectionHeadingClass, type SettingsSectionProps } from './types';

const THEMES: ReadonlyArray<AppSettings['theme']> = ['system', 'light', 'dark'];

export function GeneralSection({ settings, onChange }: SettingsSectionProps) {
  return (
    <section className="space-y-3">
      <h2 className={sectionHeadingClass}>General</h2>
      <div className={cardClass}>
        <div className={rowClass}>
          <span className="text-sm text-zinc-200">Launcher shortcut</span>
          <ShortcutRecorder
            value={settings.launcherShortcut}
            onChange={(launcherShortcut) => onChange({ launcherShortcut })}
          />
        </div>

        <div className={rowClass}>
          <span className="text-sm text-zinc-200">Theme</span>
          <select
            aria-label="Theme"
            value={settings.theme}
            onChange={(event) => onChange({ theme: event.target.value as AppSettings['theme'] })}
            className="rounded-lg bg-white/[0.08] px-2.5 py-1.5 text-sm capitalize text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.12] focus:outline-none focus:ring-sky-400/50"
          >
            {THEMES.map((theme) => (
              <option key={theme} value={theme} className="bg-[#1c1c20] capitalize">
                {theme}
              </option>
            ))}
          </select>
        </div>

        <div className={rowClass}>
          <span className="text-sm text-zinc-200">Start at login</span>
          <Toggle
            label="Start at login"
            checked={settings.autoStartOnLogin}
            onChange={(autoStartOnLogin) => onChange({ autoStartOnLogin })}
          />
        </div>
      </div>
    </section>
  );
}
