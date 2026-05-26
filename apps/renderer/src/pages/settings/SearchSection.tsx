import { trpc } from '../../lib/trpc';
import { Toggle } from '../../components/Toggle';
import { cardClass, rowClass, sectionHeadingClass, type SettingsSectionProps } from './types';

export function SearchSection({ settings, onChange }: SettingsSectionProps) {
  const utils = trpc.useUtils();
  const clear = trpc.indexer.clearIndex.useMutation({
    onSuccess: () => {
      void utils.indexer.stats.invalidate();
    },
  });

  const clearIndex = (): void => {
    if (window.confirm('Clear the entire search index? This cannot be undone.')) {
      clear.mutate();
    }
  };

  return (
    <section className="space-y-3">
      <h2 className={sectionHeadingClass}>Search</h2>
      <div className={cardClass}>
        <div className={rowClass}>
          <span className="text-sm text-zinc-200">Enable semantic search</span>
          <Toggle
            label="Enable semantic search"
            checked={settings.semanticSearchEnabled}
            onChange={(semanticSearchEnabled) => onChange({ semanticSearchEnabled })}
          />
        </div>
      </div>
      <p className="px-1 text-xs text-zinc-500">
        Semantic search downloads a ~100 MB on-device model the first time it runs.
      </p>
      <button
        type="button"
        onClick={clearIndex}
        className="rounded-lg bg-red-500/15 px-3 py-1.5 text-sm text-red-300 ring-1 ring-inset ring-red-500/20 transition-colors hover:bg-red-500/25"
      >
        Clear search index
      </button>
    </section>
  );
}
