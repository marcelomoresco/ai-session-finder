import { Command } from 'cmdk';
import type { SearchResult } from '../lib/types';
import { formatRelativeTime } from '../lib/formatRelativeTime';
import { ToolBadge } from './ToolBadge';

export interface ResultItemProps {
  readonly result: SearchResult;
  readonly onSelect: (result: SearchResult) => void;
}

/** Compact token count: 30 → "30", 12300 → "12.3k", 2_400_000 → "2.4M". */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
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
        <span className="ml-auto flex shrink-0 items-center gap-2 font-mono text-[11px] text-zinc-500">
          {result.tokens != null && result.tokens > 0 && (
            <span className="text-zinc-600">{formatTokens(result.tokens)} tok</span>
          )}
          <span>{formatRelativeTime(result.lastActivityAt)}</span>
        </span>
      </div>
      <p className="line-clamp-2 text-sm text-zinc-400">{result.snippet}</p>
    </Command.Item>
  );
}
