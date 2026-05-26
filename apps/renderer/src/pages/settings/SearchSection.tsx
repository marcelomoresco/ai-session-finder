import { trpc } from '../../lib/trpc';
import { sectionHeadingClass, type SettingsSectionProps } from './types';

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
    <section className="space-y-4">
      <h2 className={sectionHeadingClass}>Search</h2>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm">Enable semantic search</span>
        <input
          type="checkbox"
          aria-label="Enable semantic search"
          checked={settings.semanticSearchEnabled}
          onChange={(event) => onChange({ semanticSearchEnabled: event.target.checked })}
        />
      </label>
      <p className="text-xs text-zinc-500">
        Semantic search downloads a ~100 MB on-device model the first time it runs.
      </p>

      <label className="flex items-center justify-between gap-4">
        <span className="text-sm">
          Encrypt database <span className="text-zinc-500">(Pro)</span>
        </span>
        <input
          type="checkbox"
          aria-label="Encrypt database"
          checked={settings.encryptDatabase}
          onChange={(event) => onChange({ encryptDatabase: event.target.checked })}
        />
      </label>

      <button
        type="button"
        onClick={clearIndex}
        className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-300 ring-1 ring-inset ring-red-500/20 hover:bg-red-500/25"
      >
        Clear search index
      </button>
    </section>
  );
}
