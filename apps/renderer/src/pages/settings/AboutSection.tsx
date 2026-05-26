import { trpc } from '../../lib/trpc';
import { sectionHeadingClass, type SettingsSectionProps } from './types';

export function AboutSection({ onChange }: SettingsSectionProps) {
  const info = trpc.system.info.useQuery();
  const utils = trpc.useUtils();
  const install = trpc.update.install.useMutation();

  const checkForUpdates = async (): Promise<void> => {
    const update = await utils.update.check.fetch();
    if (update && window.confirm(`Version ${update.version} is available. Install and restart now?`)) {
      install.mutate();
    } else if (!update) {
      window.alert("You're on the latest version.");
    }
  };

  return (
    <section className="space-y-2">
      <h2 className={sectionHeadingClass}>About</h2>
      <p className="text-sm">AI Session Finder {info.data ? `v${info.data.version}` : ''}</p>
      <p className="text-sm text-zinc-400">
        Local search across Claude Code, Codex CLI, and Cursor sessions. Apache 2.0 License.
      </p>
      <div className="flex flex-wrap gap-4 text-sm">
        <a
          className="text-sky-400 hover:underline"
          href="https://github.com/marcelomoresco/ai-session-finder"
        >
          GitHub
        </a>
        <a
          className="text-sky-400 hover:underline"
          href="https://github.com/marcelomoresco/ai-session-finder/discussions"
        >
          Discussions
        </a>
      </div>
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={() => void checkForUpdates()}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ring-inset ring-white/10 hover:bg-white/15"
        >
          Check for updates
        </button>
        <button
          type="button"
          onClick={() => onChange({ onboardingCompleted: false })}
          className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Reset onboarding
        </button>
      </div>
    </section>
  );
}
