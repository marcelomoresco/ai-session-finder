import type { AppSettings } from '../../lib/types';

export interface SettingsSectionProps {
  readonly settings: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
}

const HEADING = 'text-xs font-semibold uppercase tracking-wider text-zinc-500';
export const sectionHeadingClass = HEADING;
