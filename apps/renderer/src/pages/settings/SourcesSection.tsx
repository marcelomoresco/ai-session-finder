import { trpc } from '../../lib/trpc';
import type { AppSettings } from '../../lib/types';
import { sectionHeadingClass, type SettingsSectionProps } from './types';

type SourceId = AppSettings['enabledSources'][number];

const SOURCES: ReadonlyArray<{ id: SourceId; label: string }> = [
  { id: 'claude-code', label: 'Claude Code' },
  { id: 'codex-cli', label: 'Codex CLI' },
  { id: 'cursor', label: 'Cursor' },
];

export function SourcesSection({ settings, onChange }: SettingsSectionProps) {
  const stats = trpc.indexer.stats.useQuery();
  const reindex = trpc.indexer.fullReindex.useMutation();
  const enabled = new Set<SourceId>(settings.enabledSources);

  const toggle = (id: SourceId): void => {
    const next = enabled.has(id)
      ? settings.enabledSources.filter((source) => source !== id)
      : [...settings.enabledSources, id];
    onChange({ enabledSources: next });
  };

  const summary = stats.data
    ? `${stats.data.indexed} sessions indexed${
        stats.data.lastSync ? ` · last sync ${new Date(stats.data.lastSync).toLocaleString()}` : ''
      }`
    : 'Loading…';

  return (
    <section className="space-y-4">
      <h2 className={sectionHeadingClass}>Sources</h2>
      {SOURCES.map(({ id, label }) => (
        <label key={id} className="flex items-center justify-between gap-4">
          <span className="text-sm">{label}</span>
          <input
            type="checkbox"
            aria-label={label}
            checked={enabled.has(id)}
            onChange={() => toggle(id)}
          />
        </label>
      ))}
      <p className="text-xs text-zinc-500">{summary}</p>
      <button
        type="button"
        onClick={() => reindex.mutate()}
        className="rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ring-inset ring-white/10 hover:bg-white/15"
      >
        Reindex all
      </button>
    </section>
  );
}
