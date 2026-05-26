import type { AppSettings } from '../../lib/types';

export interface SettingsSectionProps {
  readonly settings: AppSettings;
  readonly onChange: (patch: Partial<AppSettings>) => void;
}

const HEADING = 'px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500';
export const sectionHeadingClass = HEADING;

/** Bordered, subtly-raised container that groups a section's rows on the dark bg. */
export const cardClass =
  'divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]';

/** A single label-on-the-left, control-on-the-right row inside a card. */
export const rowClass = 'flex items-center justify-between gap-4 px-4 py-3.5';
