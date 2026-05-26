import { ShortcutRecorder } from '../../components/ShortcutRecorder';
import { Toggle } from '../../components/Toggle';
import { cardClass, rowClass, sectionHeadingClass, type SettingsSectionProps } from './types';

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
