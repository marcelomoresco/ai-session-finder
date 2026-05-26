import type { AppSettings } from '../../lib/types';
import { trpc } from '../../lib/trpc';
import { ShortcutRecorder } from '../../components/ShortcutRecorder';
import { Toggle } from '../../components/Toggle';
import { Dropdown } from '../../components/Dropdown';
import { cardClass, rowClass, sectionHeadingClass, type SettingsSectionProps } from './types';

const OPEN_IN: ReadonlyArray<{ value: AppSettings['preferredApp']; label: string }> = [
  { value: 'terminal', label: 'Terminal' },
  { value: 'iterm', label: 'iTerm2' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'intellij', label: 'IntelliJ IDEA' },
  { value: 'cursor', label: 'Cursor' },
];

export function GeneralSection({ settings, onChange }: SettingsSectionProps) {
  const available = trpc.system.availableApps.useQuery();
  // While loading, show everything; once known, only offer installed apps (plus
  // whatever is currently selected, so the saved choice is never hidden).
  const installed = available.data ?? OPEN_IN.map((option) => option.value);
  const openInOptions = OPEN_IN.filter(
    (option) => installed.includes(option.value) || option.value === settings.preferredApp,
  );

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
          <span className="text-sm text-zinc-200">Open sessions in</span>
          <Dropdown
            label="Open sessions in"
            value={settings.preferredApp}
            options={openInOptions}
            onChange={(preferredApp) => onChange({ preferredApp })}
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
