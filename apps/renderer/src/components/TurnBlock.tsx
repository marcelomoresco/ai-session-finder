import { forwardRef } from 'react';
import type { Turn } from '../lib/types';
import { parseContent } from '../lib/markdown';
import { CodeBlock } from './CodeBlock';

const ROLE_LABEL: Record<string, string> = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
};

export interface TurnBlockProps {
  readonly turn: Turn;
  readonly isFocused: boolean;
}

export const TurnBlock = forwardRef<HTMLDivElement, TurnBlockProps>(function TurnBlock(
  { turn, isFocused },
  ref,
) {
  return (
    <div
      ref={ref}
      id={`turn-${turn.id}`}
      className={`rounded-xl p-4 transition-colors ${isFocused ? 'bg-white/5 ring-2 ring-sky-500/40' : ''}`}
    >
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wider text-zinc-500">
        {ROLE_LABEL[turn.role] ?? turn.role}
      </div>
      <div className="flex flex-col gap-3">
        {parseContent(turn.contentText).map((segment, index) =>
          segment.type === 'code' ? (
            <CodeBlock key={index} code={segment.value} lang={segment.lang ?? 'text'} />
          ) : (
            <p key={index} className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-300">
              {segment.value}
            </p>
          ),
        )}
      </div>
    </div>
  );
});
