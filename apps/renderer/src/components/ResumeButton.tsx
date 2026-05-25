import { useState } from 'react';
import { trpc } from '../lib/trpc';

export interface ResumeButtonProps {
  readonly sessionId: string;
}

/**
 * Resumes a session in its original tool (opens Terminal running the resume
 * command, or opens Cursor) via `resume.run`. Also offers copy-to-clipboard.
 */
export function ResumeButton({ sessionId }: ResumeButtonProps) {
  const command = trpc.resume.buildCommand.useQuery({ sessionId });
  const launch = trpc.resume.run.useMutation();
  const [copied, setCopied] = useState(false);

  const copy = async (): Promise<void> => {
    if (!command.data) return;
    await navigator.clipboard.writeText(command.data.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resumeLabel = launch.isPending
    ? 'Opening…'
    : launch.isError
      ? 'Failed — retry'
      : launch.isSuccess
        ? '✓ Opened'
        : 'Resume session';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => launch.mutate({ sessionId })}
        disabled={launch.isPending}
        aria-label="Resume session in its original tool"
        className="rounded-lg bg-sky-500/90 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-500 disabled:opacity-50"
      >
        {resumeLabel}
      </button>
      <button
        type="button"
        onClick={() => void copy()}
        disabled={!command.data}
        aria-label={command.data ? `Copy command: ${command.data.command}` : 'Copy command'}
        className="rounded-lg bg-white/10 px-3 py-2 font-mono text-sm text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15 disabled:opacity-50"
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
    </div>
  );
}
