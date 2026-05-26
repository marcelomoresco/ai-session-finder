import { trpc } from '../../lib/trpc';
import type { AppSettings } from '../../lib/types';
import { Toggle } from '../../components/Toggle';
import { cardClass, rowClass, sectionHeadingClass, type SettingsSectionProps } from './types';

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
    <section className="space-y-3">
      <h2 className={sectionHeadingClass}>Sources</h2>
      <div className={cardClass}>
        {SOURCES.map(({ id, label }) => (
          <div key={id} className={rowClass}>
            <span className="text-sm text-zinc-200">{label}</span>
            <Toggle label={label} checked={enabled.has(id)} onChange={() => toggle(id)} />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-4 px-1">
        <p className="text-xs text-zinc-500">{summary}</p>
        <button
          type="button"
          onClick={() => reindex.mutate()}
          className="shrink-0 rounded-lg bg-white/[0.08] px-3 py-1.5 text-sm text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.14]"
        >
          Reindex all
        </button>
      </div>
    </section>
  );
}
