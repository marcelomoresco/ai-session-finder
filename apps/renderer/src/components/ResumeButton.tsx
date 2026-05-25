import { useState } from 'react';
import { trpc } from '../lib/trpc';

export interface ResumeButtonProps {
  readonly sessionId: string;
}

/** Copies the tool-specific resume command to the clipboard. */
export function ResumeButton({ sessionId }: ResumeButtonProps) {
  const [copied, setCopied] = useState(false);
  const { data } = trpc.resume.buildCommand.useQuery({ sessionId });

  const handleClick = async (): Promise<void> => {
    if (!data) return;
    await navigator.clipboard.writeText(data.command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const label = copied ? '✓ Copied' : data ? `Copy: ${data.command}` : 'Loading…';

  return (
    <button
      type="button"
      disabled={!data}
      onClick={() => void handleClick()}
      aria-label={data ? `Copy resume command: ${data.command}` : 'Loading resume command'}
      className="inline-flex max-w-full items-center gap-2 truncate rounded-lg bg-white/10 px-3 py-2 font-mono text-sm text-zinc-200 ring-1 ring-inset ring-white/10 transition-colors hover:bg-white/15 disabled:opacity-50"
    >
      {label}
    </button>
  );
}
