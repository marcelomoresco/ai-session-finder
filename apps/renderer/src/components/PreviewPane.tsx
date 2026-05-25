import { useEffect, useRef } from 'react';
import { trpc } from '../lib/trpc';
import { TurnBlock } from './TurnBlock';
import { ResumeButton } from './ResumeButton';

export interface PreviewPaneProps {
  readonly sessionId: string;
  readonly focusedTurnId?: string;
}

/** Full session view: header, turns (with highlighted code), and resume action. */
export function PreviewPane({ sessionId, focusedTurnId }: PreviewPaneProps) {
  const { data, isLoading } = trpc.session.get.useQuery({ id: sessionId });
  const focusedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    focusedRef.current?.scrollIntoView({ block: 'center' });
  }, [focusedTurnId, data]);

  if (isLoading) {
    return <div className="p-6 text-sm text-zinc-500">Loading…</div>;
  }
  if (!data) {
    return <div className="p-6 text-sm text-zinc-500">Session not found.</div>;
  }

  return (
    <article className="mx-auto flex h-full max-w-3xl flex-col gap-4 overflow-y-auto p-6">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-zinc-100">
            {data.session.projectName ?? 'Untitled session'}
          </h2>
          <p className="font-mono text-xs text-zinc-500">
            {data.turns.length} turns · {data.session.tool}
          </p>
        </div>
        <ResumeButton sessionId={data.session.id} />
      </header>
      <div className="flex flex-col gap-3">
        {data.turns.map((turn) => (
          <TurnBlock
            key={turn.id}
            turn={turn}
            isFocused={turn.id === focusedTurnId}
            ref={turn.id === focusedTurnId ? focusedRef : undefined}
          />
        ))}
      </div>
    </article>
  );
}
