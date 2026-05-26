import { trpc } from '../lib/trpc';
import type { AppSettings } from '../lib/types';
import { GeneralSection } from './settings/GeneralSection';
import { SourcesSection } from './settings/SourcesSection';
import { SearchSection } from './settings/SearchSection';
import { AboutSection } from './settings/AboutSection';

export function SettingsPage() {
  const settings = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.settings.update.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
    },
  });

  if (!settings.data) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  }

  const s = settings.data;
  const onChange = (patch: Partial<AppSettings>): void => {
    update.mutate(patch);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8 text-zinc-100">
      <h1 className="text-xl font-semibold">Settings</h1>
      <GeneralSection settings={s} onChange={onChange} />
      <SourcesSection settings={s} onChange={onChange} />
      <SearchSection settings={s} onChange={onChange} />
      <AboutSection settings={s} onChange={onChange} />
    </div>
  );
}
