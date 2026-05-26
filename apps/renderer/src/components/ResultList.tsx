import { Command } from 'cmdk';
import type { SearchResult } from '../lib/types';
import { ResultItem } from './ResultItem';

export interface ResultListProps {
  readonly results: ReadonlyArray<SearchResult>;
  readonly isLoading: boolean;
  readonly query: string;
  readonly onSelect: (result: SearchResult) => void;
}

export function ResultList({ results, isLoading, query, onSelect }: ResultListProps) {
  return (
    <Command.List className="max-h-[380px] overflow-y-auto p-2">
      {isLoading && (
        <Command.Loading>
          <div className="px-3 py-2 text-sm text-zinc-500">Searching…</div>
        </Command.Loading>
      )}
      <Command.Empty className="px-4 py-10 text-center text-sm text-zinc-500">
        {query.length === 0 ? (
          <span>No active sessions in the last 15 minutes.</span>
        ) : (
          <span>
            No matches for “<span className="text-zinc-300">{query}</span>”.
          </span>
        )}
      </Command.Empty>
      {results.map((result) => (
        <ResultItem key={result.turnId} result={result} onSelect={onSelect} />
      ))}
    </Command.List>
  );
}
