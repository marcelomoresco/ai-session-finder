import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trpc } from '../lib/trpc';
import type { AppSettings } from '../lib/types';
import { GeneralSection } from './settings/GeneralSection';
import { SourcesSection } from './settings/SourcesSection';
import { SearchSection } from './settings/SearchSection';
import { AboutSection } from './settings/AboutSection';

export function SettingsPage() {
  const navigate = useNavigate();
  const settings = trpc.settings.get.useQuery();
  const utils = trpc.useUtils();
  const update = trpc.settings.update.useMutation({
    onSuccess: () => {
      void utils.settings.get.invalidate();
    },
  });

  // Esc returns to the launcher (which then handles Esc-to-hide).
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') void navigate('/');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  if (!settings.data) {
    return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
  }

  const s = settings.data;
  const onChange = (patch: Partial<AppSettings>): void => {
    update.mutate(patch);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-8 text-zinc-100">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void navigate('/')}
          aria-label="Back to launcher"
          className="rounded-md bg-white/10 px-2 py-1 text-sm text-zinc-300 transition-colors hover:bg-white/15"
        >
          ← Back
        </button>
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>
      <GeneralSection settings={s} onChange={onChange} />
      <SourcesSection settings={s} onChange={onChange} />
      <SearchSection settings={s} onChange={onChange} />
      <AboutSection settings={s} onChange={onChange} />
    </div>
  );
}
