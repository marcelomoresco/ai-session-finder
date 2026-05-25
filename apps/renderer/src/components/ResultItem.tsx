import { Command } from 'cmdk';
import type { SearchResult } from '../lib/types';
import { formatRelativeTime } from '../lib/formatRelativeTime';
import { ToolBadge } from './ToolBadge';

export interface ResultItemProps {
  readonly result: SearchResult;
  readonly onSelect: (result: SearchResult) => void;
}

export function ResultItem({ result, onSelect }: ResultItemProps) {
  return (
    <Command.Item
      value={result.turnId}
      onSelect={() => onSelect(result)}
      className="flex cursor-pointer flex-col gap-1 rounded-lg px-3 py-2.5 text-left transition-colors data-[selected=true]:bg-white/10"
    >
      <div className="flex items-center gap-2">
        <ToolBadge tool={result.tool} />
        <span className="truncate text-sm font-medium text-zinc-100">
          {result.projectName ?? 'Unknown project'}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[11px] text-zinc-500">
          {formatRelativeTime(result.lastActivityAt)}
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-zinc-400">{result.snippet}</p>
    </Command.Item>
  );
}
