import { trpc } from '../../lib/trpc';
import { sectionHeadingClass, type SettingsSectionProps } from './types';

export function AboutSection({ onChange }: SettingsSectionProps) {
  const info = trpc.system.info.useQuery();
  const utils = trpc.useUtils();
  const install = trpc.update.install.useMutation();

  const checkForUpdates = async (): Promise<void> => {
    const update = await utils.update.check.fetch();
    if (
      update &&
      window.confirm(`Version ${update.version} is available. Install and restart now?`)
    ) {
      install.mutate();
    } else if (!update) {
      window.alert("You're on the latest version.");
    }
  };

  return (
    <section className="space-y-3">
      <h2 className={sectionHeadingClass}>About</h2>
      <div className="space-y-1 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
        <p className="text-sm font-medium text-zinc-100">
          AI Session Finder {info.data ? `v${info.data.version}` : ''}
        </p>
        <p className="text-sm text-zinc-400">
          Local search across Claude Code, Codex CLI, and Cursor sessions. Apache 2.0 License.
        </p>
        <div className="flex flex-wrap gap-4 pt-1 text-sm">
          <a
            className="text-sky-400 transition-colors hover:text-sky-300 hover:underline"
            href="https://github.com/marcelomoresco/ai-session-finder"
          >
            GitHub
          </a>
          <a
            className="text-sky-400 transition-colors hover:text-sky-300 hover:underline"
            href="https://github.com/marcelomoresco/ai-session-finder/discussions"
          >
            Discussions
          </a>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 px-1">
        <button
          type="button"
          onClick={() => void checkForUpdates()}
          className="rounded-lg bg-white/[0.08] px-3 py-1.5 text-sm text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/[0.14]"
        >
          Check for updates
        </button>
        <button
          type="button"
          onClick={() => onChange({ onboardingCompleted: false })}
          className="rounded-lg px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
        >
          Reset onboarding
        </button>
      </div>
    </section>
  );
}
