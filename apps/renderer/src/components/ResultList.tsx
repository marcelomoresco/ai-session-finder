import { Command } from 'cmdk';
import type { SearchResult } from '../lib/types';
import { ResultItem } from './ResultItem';

export interface ResultListProps {
  readonly results: ReadonlyArray<SearchResult>;
  readonly isLoading: boolean;
  readonly onSelect: (result: SearchResult) => void;
}

export function ResultList({ results, isLoading, onSelect }: ResultListProps) {
  return (
    <Command.List className="max-h-[420px] overflow-y-auto p-2">
      {isLoading && (
        <Command.Loading>
          <div className="px-3 py-2 text-sm text-zinc-500">Searching…</div>
        </Command.Loading>
      )}
      <Command.Empty className="px-3 py-10 text-center text-sm text-zinc-500">
        No results.
      </Command.Empty>
      {results.map((result) => (
        <ResultItem key={result.turnId} result={result} onSelect={onSelect} />
      ))}
    </Command.List>
  );
}
