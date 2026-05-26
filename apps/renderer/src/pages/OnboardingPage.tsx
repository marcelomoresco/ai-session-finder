import { trpc } from '../lib/trpc';

export interface OnboardingPageProps {
  readonly onComplete: () => void;
}

export function OnboardingPage({ onComplete }: OnboardingPageProps) {
  const access = trpc.permissions.fullDiskAccess.useQuery();
  const utils = trpc.useUtils();
  const openSettings = trpc.permissions.openSettings.useMutation();

  const status =
    access.data === undefined ? 'Checking…' : access.data ? '✓ Granted' : '✗ Not granted';

  return (
    <div className="mx-auto max-w-lg space-y-6 p-8 text-zinc-100">
      <h1 className="text-xl font-semibold">Welcome to AI Session Finder</h1>
      <p className="text-sm text-zinc-400">
        To index Cursor and Codex sessions, the app needs <strong>Full Disk Access</strong>. Claude
        Code lives in <code>~/.claude</code> and works without it.
      </p>

      <div className="rounded-lg bg-white/5 p-4">
        <p className="text-sm">Full Disk Access: {status}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => openSettings.mutate()}
          className="rounded-lg bg-sky-500/90 px-3 py-2 text-sm font-medium text-white hover:bg-sky-500"
        >
          Open System Settings
        </button>
        <button
          type="button"
          onClick={() => void utils.permissions.fullDiskAccess.invalidate()}
          className="rounded-lg bg-white/10 px-3 py-2 text-sm ring-1 ring-inset ring-white/10 hover:bg-white/15"
        >
          Check again
        </button>
        <button
          type="button"
          onClick={onComplete}
          className="rounded-lg px-3 py-2 text-sm text-zinc-400 hover:text-zinc-200"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
